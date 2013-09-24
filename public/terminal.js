/**
 * terminal.js - a browser pseudo terminal 
 * Copyright (c) 2013, guanglin.an (lucky315.an@gmail.com)
 */

/**
 * REF:
 *      http://en.wikipedia.org/wiki/ANSI_escape_code
 *      http://en.wikipedia.org/wiki/C0_and_C1_control_codes
 *      http://en.wikipedia.org/wiki/Control_Sequence_Introducer#Sequence_elements
 *      http://ttssh2.sourceforge.jp/manual/en/about/ctrlseq.html#CSI
 */

"use strict";

function main(){
    var term = new Terminal();
    var socket = io.connect('http://localhost:3000');

    //data recv from server
    socket.on('data', function(data){
	term.handleMessage(data);
    });

    //data send to server
    term.on('data', function(data){
	// socket.send(JSON.stringify({msg: data, command: 'shell'}));
	socket.emit('data', data);
    });
    
    term.draw();

    term.send('\r');
    term.refreshCursor();

    setInterval(function(){
    	term.refreshCursor();
    }, 500);
}


function Terminal(container, r, c){
    EventEmitter.call(this);
    
    this.$container = container | document.body;
    this.$root = null;
    this.document = document;
    
    this.$nRow = r || Terminal.ROW;
    this.$nCol = c || Terminal.COL;

    /* char content to be rendered */
    this.$rows = [];
    for(var i=0; i<this.$nRow; i++){
	var row = []; //row
	for(var j=0; j<this.$nCol; j++){
	    row[j] = [' ', Terminal.DEFAULT_SGR_ATTR];
	}
	this.$rows.push(row);
    }

    /* row divs */
    this.$rowDivs = [];
    
    /* line nums received from server */
    this.$curline = 0;
    
    /* coordinate of the cursor */
    this.$cursor = {
	x: 0,
	y: 0
    };
    /* show(1)/hide(0) cursor */
    this.$showCursor = 1;

    /* cursor blink state  */
    this.$blink_state = 0;
    
    /* save parameters as parsing escape sequence */
    this.$escParams = [];
    // this.$oscParams = [];
    this.$curParam = 0;
    
    this.$curAttr = Terminal.DEFAULT_SGR_ATTR;
    
    this.$parse_state = Terminal.COMMON;
    
    this.$window_title = '';
    
    var _this = this;
    
    //initialize listeners

    //ascii ansi... digitals
    this.document.onkeypress = function(e){

	var keycode = 0;
	var ch = null;
	e = e || event;
	
	keycode = e.keyCode || e.which || e.charCode;
	
	ch = String.fromCharCode(keycode);
	_this.send(ch);
	stopBubbling(e);
	// console.info(String.fromCharCode(keycode) + ' keycode: ' + keycode);
    };

    //
    this.document.onkeydown = function(e){
	var keycode = 0;
	var ch = null;
	e = e || event;
	
	keycode = e.keyCode || e.which || e.charCode;
	
	switch(keycode){
	case 3:
	    //cancel

	    break;
	case 6:
	    //help
	    
	    break;
	case 8:
	    //backspace
	    ch = '\x7f';
	    
	    break;
	case 9:
	    //tab
	    ch = '\t';
	    break;
	case 13:
	    //Return/Enter key
	    ch = '\r';
	    break;
	case 16:
	    //shift
	    
	    break;
	case 17:
	    //control
	    
	    break;
	case 18:
	    //alt
	    
	    break;
	case 27:
	    //esc
	    ch = '\x1b';
	    break;
        case 33:
	    //Page Up key
            break;
	case 34:
	    //page down key
	    break;
	case 35:
	    //End key
	    break;
	case 36:
	    //home key
	    break;
	case 37:
	    //left arrow
	    ch = '\x1b[D';
	    break;
	case 38:
	    //up arrow
	    ch = '\x1b[A';
	    break;
	case 39:
	    //right arrow
	    ch = '\x1b[C';
	    break;
	case 40:
	    //down arrow
	    ch = '\x1b[B';
	    break;
	case 44:
	    //print screen key
	    break;
	case 45:
	    //Ins(ert) key
	    ch = '\x1b[2~';
	    break;
	case 46:
	    //Del(ete) key
	    ch = '\x1b[3~';
	    break;
	case 112:
	    //F1
	    break;
	case 113:
	    //F2
	    break;
	case 114:
	    //F3
	    break;
	case 115:
	    //F4
	    break;
	case 116:
	    //F5
	    break;
	case 117:
	    //F6
	    break;
	case 118:
	    //F7
	    break;
	case 119:
	    //F8
	    break;
	case 120:
	    //F9
	    break;
	case 121:
	    //F10
	    break;
	case 122:
	    //F11
	    break;
	case 123:
	    //F12
	    break;
	case 144:
	    //Num Lock key
	    break;
	case 145:
	    //Scroll Lock key
	    break;
	default:
	    if( e.ctrlKey ){
		if (e.keyCode >= 65 && e.keyCode <= 90) {
		    ch = String.fromCharCode(e.keyCode - 64);
		}
	    }

	}

	if( ch ){
	    _this.send(ch);
	    stopBubbling(e);
	}
    };
};

inherits(Terminal, EventEmitter);

/**
 * state of ANSI escape code,
 */
Terminal.COMMON = 0; //command charset
Terminal.ESC = 1; //ESC
Terminal.CSI = 2; //ESC [, CSI

//Select a single character from one of the alternate character sets.
Terminal.SS2 = 3; //ESC N, 
Terminal.SS3 = 4; //ESC O, 
//Privacy Message
Terminal.PM = 5;  //ESC ^,
//Application Program Command
Terminal.APC = 6; //ESC _,
//Device control string
Terminal.DCS = 7; //ESC P,
//operating system command
Terminal.OSC = 8; //ESC ], 

//default size of pty
Terminal.ROW = 24;
Terminal.COL = 80;

//default SGR attributes
Terminal.DEFAULT_BACKGROUND_COLOR = 9;
Terminal.DEFAULT_FOREGROUND_COLOR = 7;
Terminal.DEFAULT_COMMON_TYPE = 0;
Terminal.DEFAULT_BRIGHT = 0;

//dark color, background = black, foreground = white, font
Terminal.DEFAULT_SGR_ATTR =
    Terminal.DEFAULT_BRIGHT << 12 |
    Terminal.DEFAULT_BACKGROUND_COLOR << 8 |
    Terminal.DEFAULT_FOREGROUND_COLOR << 4 |
    Terminal.DEFAULT_COMMON_TYPE;


(function(){

    //private
    var _this = this;  
    
    //public
    
    this.handleMessage = function(data){
	console.info('[Terminal]' + data.replace(/\x1b/g, 'u001b'));

	//init vars
	var content = data;
	
	this.$parse_state = this.$parse_state || Terminal.COMMON;
	
	for(var i=0; i<content.length; i++){
	    var ch = content[i];

	    switch(this.$parse_state){
	    case Terminal.COMMON:
		switch(ch){
		case '\x1b':
		    this.$parse_state = Terminal.ESC;
		    break;
		case '\t':
		    //TODO: next tab pos
		    break;
		case '\n':
		    this.$cursor.y++;
		    if( this.$cursor.y >= this.$nRow -1 ){
			this.$cursor.y = this.$nRow - 1;
		    }

		    break;
		case '\r':
		    this.$cursor.x = 0;
		    break;
		case '\b':
		    if(this.$cursor.x > 0){
			this.$cursor.x--;
		    }
		    break;
		default:
		    if( this.$cursor.x >= this.$nCol-1 ){
			this.$cursor.x = 0;
			this.$cursor.y++;

			if( this.$cursor.y >= this.$nRow -1 ){
			    this.$cursor.y = this.$nRow - 1;
			}

		    }
		    this.$rows[this.$cursor.y][this.$cursor.x] = [ch, this.$curAttr];
		    this.$cursor.x++;
		};
		break; /* Terminal.COMMON */
	    case Terminal.ESC:
		switch(ch){
		case '[':
		    this.$parse_state = Terminal.CSI;
		    break;
		case 'N':
		    //TODO: ESC N
		    this.$parse_state = Terminal.SS2;
		    break;
		case 'O':
		    //TODO: ESC O
		    this.$parse_state = Terminal.SS3;

		    break;
		case '^':
		    //TODO: ESC ^
		    this.$parse_state = Terminal.PM;
		    break;
		case '_':
		    //TODO: ESC _
		    this.$parse_state = Terminal.APC;
		    break;
		case 'P':
		    //TODO: ESC P
		    this.$parse_state = Terminal.DCS;
		    break;
		case ']':
		    //TODO: ESC ]
		    this.$parse_state = Terminal.OSC;
		    break;
		case '\x07':
		    //bell
		    
		    break;
		default:
		    //
		    console.error('[BrowserIDE][ESC]Unkown PARSE_STATE:' + ch); 
		    break;
		};

		break; /* Terminal.ESC */
	    case Terminal.CSI:
		// console.log('[BrowserIDE][CSI] CSI detacted!');
		
		switch(ch){
		case '0':/* 48 */
		case '1':
		case '2':
		case '3':
		case '4':
		case '5':
		case '6':
		case '7':
		case '8':
		case '9':
		    //a digit
		    this.$curParam = this.$curParam * 10 + ch.charCodeAt(0) - 48;
		    break;
		case '?':
		    //TODO: csi ?
		    break;
		case '>':
		    //TODO: csi >
		    break;
		case '$':
		    //TODO: csi $
		    break;
		case '\'':
		    //TODO: csi \
		    break;
		case ';':
		    //TODO: csi ;
		    this.$escParams.push(this.$curParam);
		    this.$curParam = 0;
		    break;
		default:
		    //prepare params to be used
		    this.$escParams.push(this.$curParam);
		    
		    switch(ch){
		    case 'A': 
			//CUU, Moves cursor up Ps lines in the same column.
			this.moveCursorUp(this.$escParams[0]);
			break;
		    case 'B':
			//Moves cursor down Ps lines in the same column.
			this.moveCursorDown(this.$escParams[0]);
			break;
		    case 'C':
			//Moves cursor to the right Ps columns.
			this.moveCursorRight(this.$escParams[0]);
			break;
		    case 'D':
			//Moves cursor to the left Ps columns.
			this.moveCursorLeft(this.$escParams[0]);
			break;
		    case 'E':
			//Moves cursor to the first column of Ps-th following line. 
			break;
		    case 'F':
			//Moves cursor to the first column of Ps-th preceding line. 
			break;
		    case 'G':
			//Moves cursor to the Ps-th column of the active line. 
			break;
		    case 'H':
			//Moves cursor to the Ps1-th line and to the Ps2-th column.
			this.$cursor.x = this.$escParams[1] || 0;
			this.$cursor.y = this.$escParams[0] || 0;

			// console.info('[BrowserIDE][CSI H]Row:' + this.$cursor.y + ' Col:' + this.$cursor.x);

			break; /* end of case 'H' */
		    case 'I':
			//Moves cursor to the Ps tabs forward.
			
			break;
		    case 'J':
			//Erase in display. The default value of Ps is 0.
			//Ps = 0      Erase from cursor through the end of the display.
			//   = 1      Erase from the beginning of the display through the cursor.
			//   = 2      Erase the complete of display.
			var ps = this.$escParams[0];

			switch(ps){
			case 0:
			    this.eraseDisplay(this.$cursor, {x: this.$nCol-1, y: this.$nRow-1});
			    break;
			case 1:
			    this.eraseDisplay({x:0,y:0}, this.$cursor);
			    break;
			case 2:
			    this.eraseDisplay({x:0,y:0}, {x: this.$nCol-1, y: this.$nRow-1});
			    this.renderMatrix(0, this.$nRow-1);
			    this.$cursor.x = 0;
			    this.$cursor.y = 0;
			    break;
			default:
			    console.error('[BrowserIDE][CSI J]Unknown state:' + ps);
			    break;
			}
			break; /* end of case 'J' */
		    case 'K':
			//Erase in line. The default value of Ps is 0.
			// Ps = 0      Erase from the cursor through the end of the line.
			//    = 1      Erase from the beginning of the line through the cursor.
			//    = 2      Erase the complete of line.

			var ps = this.$escParams[0];

			switch(ps){
			case 0:
			    this.eraseLine(this.$cursor.y, this.$cursor.x);
			    break;
			case 1:
			    this.eraseLine(this.$cursor.y, 0, this.$cursor.x);
			    break;
			case 2:
			    this.eraseLine(this.$cursor.y, 0);
			    break;
			default:
			    console.error('[BrowserIDE][CSI K]Unknown state:' + ps);
			    break;
			}
			
			break; /* end of case K */
		    case 'L':
			//Inserts Ps lines, stgarting at the cursor. The default 1. 
			break;
		    case 'M':
			//Deletes Ps lines in the scrolling region, starting with the line
			//that has the cursor, the default 1.
			break;
		    case 'P':
			//Deletes Ps characters from the cursor position to the right.The default 1.
			break;
		    case 'S':
			//Scroll up Ps lines. The default 1.
			break;
		    case 'T':
			//Scroll down Ps lines. The default value of Ps is 1.
			break;
		    case 'X':
			//Erase Ps characters, from the cursor positioon to the right.The default 1.
			break;
		    case 'Z':
			//Moves cursor to the Ps tabs backward.The default 1.
			break;
		    case '\'': //single quote
			//Moves cursor to the Ps-th columns of the active line. The default 1.
			break;
		    case 'a':
			//Moves cursor to the right Ps columns.The default 1.
			break;
		    case 'c':
			// Primary Device Attribute. The default value of Ps is 0.
			// Ps = 0    Asks for the terminal's architectural class and basic attributes.
			// Response: Depends the Terminal ID setting.
			//   VT100     ESC [ ? 1 ; 2 c
			//   VT100J    ESC [ ? 5 ; 2 c
			//   VT101     ESC [ ? 1 ; 0 c
			//   VT102     ESC [ ? 6 c
			//   VT102J    ESC [ ? 15 c
			//   VT220J    ESC [ ? 62 ; 1 ; 2 ; 5 ; 6 ; 7 ; 8 c
			//   VT282     ESC [ ? 62 ; 1 ; 2 ; 4 ; 5 ; 6 ; 7 ; 8 ; 10 ; 11 c
			//   VT320     CSI ? 63 ; 1 ; 2 ; 6 ; 7 ; 8 c
			//   VT382     CSI ? 63 ; 1 ; 2 ; 4 ; 5 ; 6 ; 7 ; 8 ; 10 ; 15 c
			//   VT420     CSI ? 64 ; 1 ; 2 ; 7 ; 8 ; 9 ; 15 ; 18 ; 21 c"
			//   VT520     CSI ? 65 ; 1 ; 2 ; 7 ; 8 ; 9 ; 12 ; 18 ; 19 ; 21 ; 23 ; 24 ; 42 ; 44 ; 45 ; 46 c
			//   VT525     CSI ? 65 ; 1 ; 2 ; 7 ; 9 ; 12 ; 18 ; 19 ; 21 ; 22 ; 23 ; 24 ; 42 ; 44 ; 45 ; 46 c
			
			break;
		    case 'd':
			//Move to the corresponding vertical position(line Ps) of the current column.
			//The default value is 1.
			break;
		    case 'e':
			//Moves cursor down Ps lines in the same column.
			//The default value is 1.
			break;
		    case 'f':
			//Moves cursor to the Ps1-th line and to the Ps2-th column.
			//The default value is 1.
			break;
		    case 'g':
			//Clears the tab stop. The default value of Ps is 0.
			
			break;
		    case 'h':
 			//Sets mode, detail info go to file comment .
			
			break;
		    case 'i':
			//Priting mode
			//Ps = 0 Print screen
			//   = 4 Turn off printer controller mode.
			//   = 5 Turn on printer controller mode.
			break;
		    case 'j':
			//Moves cursor to the left Ps columns.
			//The default value is 1.
			break;
		    case 'k':
			//Moves cursor up Ps lines in the same column.
			//The default value is 1.
			break;
		    case 'l':
			//Resets mode
			break;
		    case 'm':
			//SGR, Character Atrributes, see more info at REF
			this.setCharAttr();
			break;
		    case 'n':
			//Reports device status
			//Ps = 5  Request the terminal's operation status report.
			//        Always return 'CSI 0 n' (Terminal).
			//  =  6  Request cursor position report.
			//        Response: CSI r; cR
			//         r     Line number
			//         c     Column number
			
			
			break;
		    case 'r':
			//Set top and bottom margins.
			//Ps1   Line number for the top margin.
			//      The default value is 1.
			//Ps2   Line number for the bottom margin.
			//      The default value is number of lines per screen.
			
			break;
		    case 's':
			//| CSI s        | Save cursor position. Same as DECSC.SCP  |
			//|              | only works when DECLRMM is reset.        |
			//|--------------+------------------------------------------|
			//| CSI Ps1;Ps2s | Set left and right margins. DECSLRM only |
			//|              | works when DECLRMM is set                |
			
			break;
		    case 't':
			//Window manipulation.
			//
			// Ps1 =  1    De-iconify window.
			//     =  2    Minimize window.
			//     =  3    Move window to [Ps2, Ps3].
			//     =  4    Resize window to height Ps2 pixels and width Ps3 pixels.
			//     =  5    Raise the window to the top of the stacking order.
			//     =  6    Lower the window to the bottom of the stacking order.
			//     =  7    Refresh window.
			//     =  8    Resize window to Ps2 lines and Ps3 columns.
			//     =  9    Change maximize state of window.
			//             Ps2 = 0    Restore maximized window.
			//                 = 1    Maximize window.
			//
			//     = 11    Reports window state.
			//             Response: CSI s t
			//               s = 1    Normal. (non-iconified)
			//                 = 2    Iconified.
			//
			//     = 13    Reports window position.
			//             Response: CSI 3 ; x ; y t
			//               x    X position of window.
			//               y    Y position of window.
			//
			//     = 14    Reports window size in pixels.
			//             Response: CSI 4 ; y ; x t
			//               y    Window height in pixels.
			//               x    Window width in pixels.
			//
			//     = 18    Reports terminal size in characters.
			//             Response: CSI 8 ; y ; x t
			//               y    Terminal height in characters. (Lines)
			//               x    Terminal width in characters. (Columns)
			//
			//     = 19    Reports root window size in characters.
			//             Response: CSI 9 ; y ; x t
			//               y    Root window height in characters.
			//               x    Root window width in characters.
			//
			//     = 20    Reports icon label.
			//             Response: OSC L title ST
			//               title    icon label. (window title)
			//
			//     = 21    Reports window title.
			//             Response: OSC l title ST
			//               title    Window title.
			//     = 22    Save window title on stack.
			//             Ps2 = 0, 1, 2    Save window title.
			//     = 23    Restore window title from stack.
			//             Ps2 = 0, 1, 2    Restore window title.

			break;
		    case 'u':
			//Restore cursor position. Same as DECRC.
			
			break;
		    case 'r':
			//if csiParam[0] == '<' && csiParam.length == 2 : Restore cursor position.Same as DECRC.
			
			break;
		    case 's':
			//if csiParam[0] == '<' && csiParam.length == 2 : Restore IME open state.
			
			break;
		    default:
			console.error('[BrowserIDE][CSI]Unknown EOF :' + ch);
		    }

		    //
		    this.clearEscParams();
		    this.$parse_state = Terminal.COMMON;
		    break;
		}

		break; /* Terminal.CSI */
	    case Terminal.SS2:
		break;
	    case Terminal.SS3:
		break;
	    case Terminal.PM:
		break;
	    case Terminal.APC:
		break;
	    case Terminal.DCS:
		break;
	    case Terminal.OSC:
		//OSC Ps ; Pt ST
		//OSC Ps ; Pt BEL
		// console.info('[BrowserIDE] OSC detacted!');

		switch(ch){
		case ';':
		    //seperator of params
		    this.$escParams.push(this.$curParam);
		    this.$curParam = ''; //2nd param is a string
		    break;
		case '\\':
		    //String Terminator (ST)
		    //OSC Ps ; Pt ST
		    
		    break;
		case '\x07':
		    //BEL
		    //OSC Ps ; Pt BEL
		    this.$escParams.push(this.$curParam);
		    if( this.$escParams.length === 2 ){ //Ps; Pt
			switch(this.$escParams[0]){
			case 0:
			case 1:
			case 2:
			    //set window title
			    this.$window_title = this.$escParams[1];
			    break;
			default:
			    console.error('[BrowserIDE][OSC][BEL]Unknown Ps Param: ' + this.$escParam[0] + 'Maybe need to update [OSC][BEL] parser!');
			    break;
			}

			//resets
			this.clearEscParams();
			this.$parse_state = Terminal.COMMON;
		    }

		    this.$parse_state = Terminal.COMMON;
		    break;
		default:
		    if( this.$escParams.length ===0 && isDigit(ch) ){
			//just handle 1st param Ps(single digit),0 < ch < 9
			this.$curParam = this.$curParam * 10 + ch.charCodeAt(0) - 48;
		    } else {
			//handle 2nd param Pt(text string)
			this.$curParam += ch;
		    }
		    
		    
		}
		
		// if( isDigit(ch) ){
		//     //0 < ch < 9
		//     this.$curParam = this.$curParam * 10 + ch.charCodeAt(0) - 48;
		// }
		
		break; /* Terminal.OSC */
	    default:

	    }
	    
	    // switch(ch){
	    // case '\r':
	    // 	ch = '';
	    // 	break;
	    // case '\n':
	    // 	this.$curline++;
	    // 	this.$cursor.y++;
	    // 	ch='';
	    // 	break;
	    // }
	    
	    // this.$rows[this.$curline].innerHTML += ch;
	}
	
	this.renderMatrix(0, this.$cursor.y);
    };
    
    this.draw = function(){
	var oRowDiv = null;
	this.$root = this.document.createElement('div');
	this.$root.className = 'terminal';
	
	for(var i = 0; i < this.$nRow; i++) {
	    oRowDiv = this.document.createElement('div');
	    this.$root.appendChild(oRowDiv);
	    this.$rowDivs.push(oRowDiv);
	}

	if( this.$container == false){
	    this.$container = document.body;
	    this.$container.appendChild(this.$root);
	}
    };  

    this.setCharAttr = function(){
	console.info('[Parameters]:' + this.$escParams);

	var curAttr = 0;

	if( this.$escParams.length === 0 ){
	    curAttr = Terminal.DEFAULT_SGR_ATTR;
	} else {
	    //0-3 bit
	    var char_type = Terminal.DEFAULT_SGR_ATTR & 0xf;
	    //4-7 bit
	    var fg = Terminal.DEFAULT_SGR_ATTR >> 4 & 0xf;
	    //8-11 bit
	    var bg = Terminal.DEFAULT_SGR_ATTR >> 8 & 0xf;
	    //12th bit
	    var bright = Terminal.DEFAULT_SGR_ATTR >> 12 & 1;
	    
	    for(var i=0; i<this.$escParams.length; i++){
		var param = this.$escParams[i];
		if( param >=0 && param < 30 ){
		    switch(param){
		    case 0:
			//Normal
			char_type = 0;
			break;
		    case 1:
			//Bold
			char_type = 1;
			break;
		    case 4:
			//Underlined
			char_type = 2;
			break;
		    case 5:
			//Blink
			char_type = 3;
			break;
		    case 7:
			//Inverse
			char_type = 4;
			break;
		    case 22:
			//Normal(heighter bold nor faint)
			char_type = 5;
			break;
		    case 24:
			//Not underlined
			char_type = 6;
			break;
		    case 25:
			//Steady(not blinking)
			char_type = 7;
			break;
		    case 27:
			//Positive (not inverse)
			char_type = 8;
			break;
		    default:
			console.error('[BrowserIDE][SGR]Unknown character attribute:' + param);
			char_type = 0; //normal
		    }
		} else if(param >= 30 && param <= 39){
		    if (param >= 30 && param <= 37){
			//set foreground color
			// curAttr = (param - 30) << 4 | curAttr;
			fg = param - 30;
		    } else if (param === 38){
			//Set foreground color in RGB value, matching
			//closet entry in 256 colors palette.
			//TODO: fg color == rgb 
		    } else {
			//param = 39, Set foreground color to default
			fg = Terminal.DEFAULT_FOREGROUND_COLOR;
		    }
		} else if(param >= 40 && param <= 49){
		    if( param >= 40 && param <= 47 ){
			//set background color
			// curAttr = (param - 40) << 8 | curAttr;
			bg = param - 40;
		    } else if(param === 48) {
			//Set background color in RGB value,
			//matching closet entry in 256 colors palette.
			//TODO: bg color == rgb
		    } else {
			//param = 49, Set background color to default
			bg = Terminal.DEFAULT_BACKGROUND_COLOR;
		    }
		} else if(param >= 90 && param <= 97){
		    //Set Bright foreground color
		    // curAttr = 1 << 12 | (param - 90) << 4 | curAttr;
		    bright = 1;
		    fg = param - 90;
		    
		} else if(param >= 100 && param <= 107){
		    //Set Bright background color
		    // curAttr = 1 << 12 | (param - 100) << 8 | curAttr;
		    bright = 1;
		    bg = param - 107;
		}
	    }

            curAttr = bright << 12 | bg << 8 | fg << 4 | char_type;
	}
	
	this.$curAttr = curAttr;
    };

    //rStart[0,~](row start pos), rEnd[~, this.$nRow-1](row end pos)
    this.renderMatrix = function(rStart, rEnd){
	// var r = this.$cursor.y;
	var iRow = 0;
	
	if( rStart ){
	    iRow = rStart;
	}
	
	for(; iRow <= rEnd; iRow++){
	    var preAttr = Terminal.DEFAULT_SGR_ATTR;
	    var htmlStart = '';
	    var bSpanOpen = false;
	    
	    for(var iCol=0; iCol< this.$nCol; iCol++){
		var ch = this.$rows[iRow][iCol][0];
		var attr = this.$rows[iRow][iCol][1];
		
		//SGR default attr
		var char_type = attr & 0xf;
		var fg = attr >> 4 & 0xf;
		var bg = attr >> 8 & 0xf;
		//more good looking than dark, so ...
		//use bright mode temporary while debuging...
		var bright = 1; //var bright = attr >> 12 & 1; 

		
		// console.info('Row:' + iRow + ' Col:' + iCol + ' ch:' + ch + ' attr:' + attr);
		
		if( this.$showCursor &&
		    this.$blink_state &&
		    iRow === this.$cursor.y &&
		    iCol === this.$cursor.x){
		    attr = 4 | attr;
		    //reverse fg & bg color
		    fg ^= bg;
		    bg ^= fg;
		    fg ^= bg;
		    htmlStart += '<span class="reverse-video"' +
			'style="' +
			'color:' + Terminal.COLOR[fg][0] + ';' +
			'background:' + Terminal.COLOR[bg][0] + ';' + '">';
		} else {
		    if( attr !== preAttr ){
			if( preAttr !== Terminal.DEFAULT_SGR_ATTR ){
			    htmlStart += '</span>';
			}

			if( attr !== Terminal.DEFAULT_SGR_ATTR ){
			    htmlStart += '<span style="' +
				'font-weight:' + (char_type === 1 ? 'bold' : 'normal') + ';' +
				'color:' + Terminal.COLOR[fg][bright] + ';' +
				'background:' + Terminal.COLOR[bg][bright]+ ';' + '">';
			    
			}

		    }

		}

		switch(ch){
		case ' ':
		    //blank_space
		    ch = '&nbsp';
		    break;
		case '<':
		    ch = '&lt;'
		    break;
		case '>':
		    ch = '&gt;';
		    break;
		case '&':
		    ch = '&amp;';
		    break;
		case '"':
		    ch = '&quot;';
		    break;
		case '\'':
		    // ch = 'apos' //IE not support ?
		    break;
		default:
		    
		}
		htmlStart += ch;
		
		//save previous attribute
		preAttr = attr;
	    }
	    if( preAttr !== Terminal.DEFAULT_SGR_ATTR ){
		htmlStart += '</span>';
	    }
	    this.$rowDivs[iRow].innerHTML = htmlStart;

	    // console.info('[BrowserIDE][Render][Row:'+ iRow +']' + htmlStart);
	}

	if( this.$container ){
	    this.$container.appendChild(this.$root);
	}
    };

    //r(row), s(start pos), e(end pos)
    this.eraseLine = function(r, s, e){
	var _s = s || 0;
	var _e = e || this.$nCol;
	
	for(var iCol= _s; iCol<_e; iCol++){
	    this.$rows[r][iCol] = [' ', Terminal.DEFAULT_SGR_ATTR];
	}
    };

    //s(row), e(col)
    this.eraseDisplay = function(s, e){
	var isRow = s.y;
	var isCol = s.x;
	var endRow = e.y;
	var endCol = e.x;

	for(; isRow <= endRow; isRow++){
	    if(isRow === s.y){
		//1st line
		this.eraseLine(isRow, s.x);
		continue;
	    }

	    if(isRow === e.y){
		this.eraseLine(isRow, 0, e.x);
		continue;
	    }

	    this.eraseLine(isRow);
	}
	
    };

    this.moveCursorUp = function(n){
	console.log('[BrowserIDE][CursorUp]:' + n);

	this.$cursor.y -= 1;
	
	if( this.$cursor.y < 0 ){
	    this.$cursor.y = 0
	}

    };

    this.moveCursorDown = function(n){
	console.log('[BrowserIDE][CursorDown]:' + n);

	this.$cursor.y += 1;

	if( this.$cursor.y >= this.$nRow ){
	    this.$cursor.y = this.$nRow - 1;
	}
    };

    this.moveCursorLeft = function(n){
	console.log('[BrowserIDE][CursorLeft]:' + n);
	
	this.$cursor.x -= 1;

	if( this.$cursor.x < 0 ){
	    this.$cursor.x = 0;
	}

    };

    this.moveCursorRight = function(n){
	console.log('[BrowserIDE][CursorRight]:' + n);
	
	this.$cursor.x += 1;

	if( this.$cursor.x >= this.$nCol ){
	    this.$cursor.x = this.$nCol - 1;
	}

    };
    
    this.refreshCursor = function(){
	var r = this.$cursor.y;
	var c = this.$cursor.x;
	this.$showCursor = 1;
	this.$blink_state ^= 1;
	this.renderMatrix(r, r);
    };

    //reverse fg/bg color
    this.reverseColor = function(attr){
	var char_type = attr & 0xf;
	var fg = attr >> 4 & 0xf;
	var bg = attr >> 8 & 0xf;
	var bright = attr >> 12 & 1;

	attr = bright << 12 | fg << 8 | bg << 4 | char_type;
    };

    this.clearEscParams = function(){
	this.$curParam = 0;
	this.$escParams = [];
    };
    
    //send data to server
    this.send = function(data){
	this.emit('data', data);
    };
    
}).call(Terminal.prototype);

//EventEmitter , node.js style api
function EventEmitter(){
    this.$events = {};
}

(function(){
    //public

    this.emit = function(type){
	if( !this.$events || !this.$events[type] ){
	    return;
	}

	var args = Array.prototype.slice.call(arguments, 1);
	for (var i = 0; i < this.$events[type].length; ++i)
	{
	    var fn = this.$events[type][i];
	    switch(args.length){
	    case 1:
		fn.call(this, args[0]);
		break;
	    case 2:
		fn.call(this, args[0], args[1]);
		break;
	    default:
		fn.call(this, args);
	    };
	}
    };

    this.addListener = function(type, listener){
	if( typeof listener !== 'function'){
	    throw TypeError('listener must be a function!');
	}

	this.$events = this.$events || {};
	this.$events[type] = this.$events[type] || [];
	
	this.$events[type].push(listener);
    };

    this.on = this.addListener;

    this.removeListener = function(type, listener){
	if( !this.$events[type] ){
	    return ;
	}

	if( typeof listener !== 'function'){
	    throw TypeError('listener must be a function!');
	}
	
	for (var i = this.$events[type].length-1; i >= 0; --i)
	{
	    if( this.$events[type][i] === listener ){
		return this.$events[type].splice(i, 1);
	    }
	}
    };

    this.removeAllListeners = function(type){
	if( this.$events[type] ){
	    delete this.$events[type];
	}
    };

    this.listeners = function(type){
	return this.$events[type] || [];
    };

}).call(EventEmitter.prototype);

//utils

function inherits(ctor, superCtor) {
    function f() {
	this.constructor = ctor;
    }
    f.prototype = superCtor.prototype;
    ctor.prototype = new f();
}

function stopBubbling(e){
    if (e.preventDefault){
	e.preventDefault();
	e.returnValue = false;;
    }
    if (e.stopPropagation){
	e.stopPropagation();
	e.cancelBubble = true;
    }
}

function getStyle(element, attr_name){
    if( element.currentStyle ){
	return element.currentStyle[attr_name];
    } else {
	return getComputedStyle(element, false)[attr_name];
    }
}

function isDigit(ch){
    return ch >= '0' && ch <= '9';
}

Terminal.COLOR = {
//idx: ['Dark',    'Bright']     
    0: ['#000000', '#000000'], //black
    1: ['#cd0000', '#ff0000'], //red
    2: ['#00cd00', '#00ff00'], //green
    3: ['#cdcd00', '#ffff00'], //yellow
    4: ['#0000ee', '#5c5cff'], //blue
    5: ['#cd00cd', '#ff00ff'], //magenta
    6: ['#00cdcd', '#00ffff'], //cyan
    7: ['#e5e5e5', '#ffffff'], //white
    9: ['#303030', '#303030'] //default background color, for test
};

Terminal.keyNames = {3: "Enter", 8: "Backspace", 9: "Tab", 13: "Enter", 16: "Shift", 17: "Ctrl", 18: "Alt",
                     19: "Pause", 20: "CapsLock", 27: "Esc", 32: "Space", 33: "PageUp", 34: "PageDown", 35: "End",
                     36: "Home", 37: "Left", 38: "Up", 39: "Right", 40: "Down", 44: "PrintScrn", 45: "Insert",
                     46: "Delete", 59: ";", 91: "Mod", 92: "Mod", 93: "Mod", 109: "-", 107: "=", 127: "Delete",
                     186: ";", 187: "=", 188: ",", 189: "-", 190: ".", 191: "/", 192: "`", 219: "[", 220: "\\",
                     221: "]", 222: "'", 63276: "PageUp", 63277: "PageDown", 63275: "End", 63273: "Home",
                     63234: "Left", 63232: "Up", 63235: "Right", 63233: "Down", 63302: "Insert", 63272: "Delete"};
