// Holds text provided by user
let message = 'Thanks for checking out my website.';

// Version of qr code in range 1 to 40
let version;

// Length of qr code sides dependent upon version
let size;

// Correction level of qr code: LOW, MEDIUM, QUARTILE, HIGH 
let level;

// Type of data in message: NUM, ALPHA, BIN
let type;

// 2D array code shall hold qr code structure
let code; // code[y][x]

// Object which draws the qr code
let canvas = document.getElementById('canvas');

// Message encoded into an array of bits
let stream;

// Stream structured as (0-255) bytes
let codewords;

// Error correction words structured as (0-255) bytes
let ecwords;

// Parameters for data and error correction codewords
let ecGuide;

// All codewords and error correction word in order
let totalWords;

// Creates a default qr code for when page intially loads
let notFirst = false;
encode();
notFirst = true;

// Adds event listener for generate button
document.getElementById('generate').addEventListener('click', encode);

// Adds event listener for download button
document.getElementById('download').addEventListener('click', download);

// Primary function which begins qr encoding process
async function encode() {
	// Loads critical information into variables
	if(notFirst) {
		message = document.getElementById('mess').value;
		if(message.length === 0) return;
	}
	level = getLevel();
	version = await getVersion();
	size = 4 * version + 17;
	
	// Creates qr code static structure 
	intializeCode();
	finder(0,0);
	finder(0,size-7);
	finder(size-7,0);
	separator();
	timing();
	alignment();

	// Adds encoded information
	ecGuide = await errorCorrectionGuide();
	stream = messageConversion();
	if(version > 6) versBlock();

	// Generates codewords and error correction words
	codewords = poly();
	ecwords = [];
	codewords.forEach((val) => {
		val.forEach((w) => ecwords.push(division(w,ecGuide[2])));
	});
	ecwords = await Promise.all(ecwords);
	console.log(ecwords);

	// Put it all together
	totalWords = [...interleaveData(), ...interleaveError()];
	totalWords = totalWords.map((x) => x.toString(2).padStart(8,'0'));
	console.log(totalWords);

	// Place data on qr code
	let paths = []
	for(let i = 0; i < 8; i++) paths[i] = dataPlacement(i);
	let tty = await Promise.all(paths)
		.then((val) => {
			return val.map((v) => penalty(...v));
		})
		.then((val) => {
			console.log(val);
			let best = 0;
			for(let k = 1; k < 8; k++) {
				if(val[k][2] < val[best][2]) 
					best = k;
			}
			return val[best];
		});
	code = tty[1];
	console.log(tty);

	// Displays finished qr code
	displayQR();
}

// Retrieves correction level from radio buttons
function getLevel() {
	const options = document.getElementsByName('radio');
	for(let i = 0; i < options.length; i++) {
		if(options[i].checked) {
			return options[i].value;
		}
	}
}

// Determines vesion based on message length
async function getVersion() {
	// Determines the input mode of the message
	let col;
	if(/^[0-9]+$/.test(message)) {
		type = 'NUM';
		col = 1;
	} else if(/^[A-Z0-9\u0020\$\*\+\.%\-/:]+$/.test(message)) {
		type = 'ALPHA';
		col = 2;
	} else {
		type = 'BIN';
		col = 3;
	}

	// Chooses corresponding csv file for correction level
	let csvFilePath;
	switch(level) {
		case 'LOW':
			csvFilePath = './CSV_Tables/L_capacity.csv';
			break;
		case 'MEDIUM':
			csvFilePath = './CSV_Tables/M_capacity.csv';
			break;
		case 'QUARTILE':
			csvFilePath = './CSV_Tables/Q_capacity.csv';
			break;
		case 'HIGH':
			csvFilePath = './CSV_Tables/H_capacity.csv';
			break;
	}
	
	// Parses through csv file and finds version based on message length and inut mode
	try {
		const csvData = await fetchData(csvFilePath);
		for (let i = 0; i < 40; i++) {
			if(message.length < csvData[i][col]) {
				console.log('Version: ' + csvData[i][0]);
				return csvData[i][0];
			}
		}

		// Runs if message is larger than version 40 capacity
		console.log('Version: ' + csvData[39][0] + ', message truncated');
		message.substring(0,csvData[39][col]);
		return csvData[39][0];
	} catch (error) {
		console.error('Error fetching or processing CSV data:', error);
	}
}

// Retrieves table from selected csv file
async function fetchData(csvFilePath) {
	try {
		const response = await fetch(csvFilePath);
		if(!response.ok) {
			throw new Error('Failed to fetch CSV data');
		}
		const data = await response.text();
		const csvData = data.split('\n').slice(1).map(row => row.split(','));
		// console.log(csvData);
		return csvData;
	} catch(error) {
		throw error;
	}
}

// Iniiallizes code
function intializeCode() {
	// code[rows][columns]
	code = new Array(size);
	for(let i = 0; i < size; i++) {
		code[i] = new Array(size);
		for(let j = 0; j < size; j++)
			code[i][j] = null;
	}
}

// Places finder pattern
function finder(row, col) {
	for (let i = row, x = 0; x < 7; i++, x++) {
		switch(x) {
			case 0:
			case 6:
				code[i][col+1] = true;
				code[i][col+5] = true;
			case 2:
			case 3:
			case 4:
				code[i][col+2] = true;
				code[i][col+3] = true;
				code[i][col+4] = true;
			case 1:
			case 5:
				code[i][col] = true;
				code[i][col+6] = true;
				break;
		}
		switch(x) {
			case 1:
			case 5:
				code[i][col+2] = false;
				code[i][col+3] = false;
				code[i][col+4] = false;
			case 2:
			case 3:
			case 4:
				code[i][col+1] = false;
				code[i][col+5] = false;
				break;
		}
	}
}

// Places 0 bits around finder pattern
function separator() {
	for(let i = 0; i < 8; i++) {
		code[7][i] = false;
		code[i][7] = false;
		code[size-8][i] = false;
		code[i][size-8] = false;
		code[size-8+i][7] = false;
		code[7][size-8+i] = false;
	}
}

// Places timing pattern
function timing() {
	for(let i = 7; i < size - 7; i++) {
		switch (i % 2) {
			case 0:
				code[6][i] = true;
				break;
			case 1:
				code[6][i] = false;
				break;
		}
	}

	for(let j = 7; j < size - 7; j++) {
		switch (j % 2) {
			case 0:
				code[j][6] = true;
				break;
			case 1:
				code[j][6] = false;
				break;
		}
	}

	// Adds the dark module
	code[4*version+9][8] = true;
}

// Places single alignment pattern
async function align(row, col) {
	for (let i = row-2, x = 0; x < 5; i++, x++) {
		switch(x) {
			case 0:
			case 4:
				code[i][col-2] = true;
				code[i][col-1] = true;
				code[i][col] = true;
				code[i][col+1] = true;
				code[i][col+2] = true;
				break;
			case 2:
				code[i][col-2] = true;
				code[i][col-1] = false;
				code[i][col] = true;
				code[i][col+1] = false;
				code[i][col+2] = true;
				break;
			case 1:
			case 3:
				code[i][col-2] = true;
				code[i][col-1] = false;
				code[i][col] = false;
				code[i][col+1] = false;
				code[i][col+2] = true;
				break;
		}
	}
}

// Places all alignment patterns
function alignment() {
	let alignmentPoint;

	switch(version) {
		case '1':
			alignmentPoint = [];
			break;
		case '2':
			alignmentPoint = [6, 18];
			break;
		case '3':
			alignmentPoint = [6, 22];
			break;
		case '4':
			alignmentPoint = [6, 26];
			break;
		case '5':
			alignmentPoint = [6, 30];
			break;
		case '6':
			alignmentPoint = [6, 34];
			break;
		case '7':
			alignmentPoint = [6, 22, 38];
			break;
		case '8':
			alignmentPoint = [6, 24, 42];
			break;
		case '9':
			alignmentPoint = [6, 26, 46];
			break;
		case '10':
			alignmentPoint = [6, 28, 50];
			break;
		case '11':
			alignmentPoint = [6, 30, 54];
			break;
		case '12':
			alignmentPoint = [6, 32, 58];
			break;
		case '13':
			alignmentPoint = [6, 34, 62];
			break;
		case '14':
			alignmentPoint = [6, 26, 46, 66];
			break;
		case '15':
			alignmentPoint = [6, 26, 48, 70];
			break;
		case '16':
			alignmentPoint = [6, 26, 50, 74];
			break;
		case '17':
			alignmentPoint = [6, 30, 54, 78];
			break;
		case '18':
			alignmentPoint = [6, 30, 56, 82];
			break;
		case '19':
			alignmentPoint = [6, 30, 58, 86];
			break;
		case '20':
			alignmentPoint = [6, 34, 62, 90];
			break;
		case '21':
			alignmentPoint = [6, 28, 50, 72, 94];
			break;
		case '22':
			alignmentPoint = [6, 26, 50, 74, 98];
			break;
		case '23':
			alignmentPoint = [6, 30, 54, 78, 102];
			break;
		case '24':
			alignmentPoint = [6, 28, 54, 80, 106];
			break;
		case '25':
			alignmentPoint = [6, 32, 58, 84, 110];
			break;
		case '26':
			alignmentPoint = [6, 30, 58, 86, 114];
			break;
		case '27':
			alignmentPoint = [6, 34, 62, 90, 118];
			break;
		case '28':
			alignmentPoint = [6, 26, 50, 74, 98, 122];
			break;
		case '29':
			alignmentPoint = [6, 30, 54, 78, 102, 126];
			break;
		case '30':
			alignmentPoint = [6, 26, 52, 78, 104, 130];
			break;
		case '31':
			alignmentPoint = [6, 30, 56, 82, 108, 134];
			break;
		case '32':
			alignmentPoint = [6, 34, 60, 86, 112, 138];
			break;
		case '33':
			alignmentPoint = [6, 30, 58, 86, 114, 142];
			break;
		case '34':
			alignmentPoint = [6, 34, 62, 90, 118, 146];
			break;
		case '35':
			alignmentPoint = [6, 30, 54, 78, 102, 126, 150];
			break;
		case '36':
			alignmentPoint = [6, 24, 50, 76, 102, 128, 154];
			break;
		case '37':
			alignmentPoint = [6, 28, 54, 80, 106, 132, 158];
			break;
		case '38':
			alignmentPoint = [6, 32, 58, 84, 110, 136, 162];
			break;
		case '39':
			alignmentPoint = [6, 26, 54, 82, 110, 138, 166];
			break;
		case '40':
			alignmentPoint = [6, 30, 58, 86, 114, 142, 170];
			break;
		default:
			alignmentPoint = []
			break;
	}

	for(let i = 0, a = alignmentPoint.length; i < a; i++) {
		for(let j = 0; j < a; j++) {
			if(!(i === 0 && j === 0) && !(i === 0 && j === a - 1) && !(i === a - 1 && j === 0)) {
				align(alignmentPoint[i], alignmentPoint[j]);
			}
		}
	}
}

// Displays and scales qr code
function displayQR() {
	const pixel = 20;
	canvas.width = canvas.height = pixel * size;
	const content = canvas.getContext('2d');

	code.map(async (row,rowIndex) => {
		for(let j = 0; j < size; j++) {
			switch(row[j]) {
				case true:
					content.fillStyle = 'black';
					break;
				case false:
					content.fillStyle = 'white';
					break;
				default:
					content.fillStyle = 'red';
					break;
			}
			content.fillRect(j*pixel,rowIndex*pixel,pixel,pixel);
		}
	});
}

// Prompt user to download qr code as png
async function download() {
	// Create temporary canvas
	const framedCanvas = document.createElement('canvas');
	const fc = framedCanvas.getContext('2d');

	// Temporary canvas in made slight larger than original canvas
	const borderWidth = size*2;
	framedCanvas.height = framedCanvas.width = size * 20 + 2 * borderWidth;
	
	// Original canvas placed in center of temporary canvas
	fc.fillStyle = 'white';
	fc.fillRect(0,0,framedCanvas.width,framedCanvas.height);
	fc.drawImage(canvas,borderWidth,borderWidth);
	
	// Image generated from temporary canvas and downloaded
	const psuedoLink = document.createElement('a');
	psuedoLink.href = framedCanvas.toDataURL("image/png");
	psuedoLink.download = "custom_qr_code.png"
	psuedoLink.click();
}

// Converts message to an array of bits dependent on type
function messageConversion() {
	// Holds the message bits
	let byteStream = '';

	// The leading bits which represent message type
	let mode = '';

	// Amount of reserved bits for representing message length
	let countSize;

	// Chooses the mode and countSize based on type 
	switch(type) {
		case 'NUM':
			mode = '0001';
			if(version < 10) countSize = 10;
			else if(version < 27) countSize = 12;
			else countSize = 14;
			break;
		case 'ALPHA':
			mode = '0010';
			if(version < 10) countSize = 9;
			else if(version < 27) countSize = 11;
			else countSize = 13;
			break;
		case 'BIN':
			mode = '0100';
			if(version < 10) countSize = 8;
			else if(version < 27) countSize = 16;
			else countSize = 16;
			break;
	}

	let len;
	const count = message.length.toString(2).padStart(countSize,'0');

	switch(type) {
		case 'NUM':
			let small = '';
			// Adjusts how the last set of characters are converted
			switch(message.length % 3) {
				case 0:
					len = message.length;
					break;
				case 1:
					len = message.length - 1;
					small = parseInt(message.substring(len,len+1)).toString(2);
					small = small.padStart(4,'0');
					break;
				case 2:
					len = message.length - 2;
					small = parseInt(message.substring(len,len+2)).toString(2);
					small = small.padStart(7,'0');
					break;
			}

			// Converts every 3 characters into 10 bits
			for(let i = 0; i < len; i += 3) {
				const byte = parseInt(message.substring(i,i+3)).toString(2);
				byteStream += byte.padStart(10,'0');
			}

			byteStream += small;
			break;
		case 'ALPHA':
			let half = ''; 
			// Adjusts how the last set of characters are converted
			switch(message.length % 2) {
				case 0:
					len = message.length;
					break;
				case 1:
					len = message.length-1;
					let pair = alphaMap(message[len]);
					half = pair.toString(2).padStart(6,'0');
					break;
			}

			// Converts every 2 characters into 11 bits
			for(let i = 0; i < len; i += 2) {
				const pair = 45 * alphaMap(message[i]) + alphaMap(message[i+1]);
				const byte = pair.toString(2).padStart(11,'0');
				byteStream += byte;
			}

			byteStream += half;
			break;
		case 'BIN':
			// Converts every character into 8 bits
			for(let i = 0; i < message.length; i++) {
				const byte = message.charCodeAt(i).toString(2);
				byteStream += byte.padStart(8,'0');
			}
			break;
	}

	byteStream = mode + count + byteStream;

	// Adds up to 4 '0' bits if byteStream in too small
	if(byteStream.length < ecGuide[1] * 8) {
		byteStream = byteStream.concat('0000').substring(0,ecGuide[1]*8);
	}

	// Pads byteStream with '0' bits if length isn't a multiple of 8
	if(byteStream.length % 8 != 0) {
		byteStream = byteStream.padEnd(byteStream.length+(8-byteStream.length%8),'0');
	}

	// Pads byteStream with alternating filler bytes until it is reaches standard length
	for(let r = ecGuide[1] - byteStream.length/8, i = 0; i < r; i++) {
		switch(i % 2) {
			case 0:
				byteStream += '11101100';
				break;
			case 1:
				byteStream += '00010001';
				break;
		}
	}

	console.log('Length: %i (%i)\nStream: %s',byteStream.length,byteStream.length/8,byteStream);
	return byteStream;
}

// Maps characters to their number value for alphanumerical type
function alphaMap(char) {
	switch (char) {
		case '0': return 0;
		case '1': return 1;
		case '2': return 2;
		case '3': return 3;
		case '4': return 4;
		case '5': return 5;
		case '6': return 6;
		case '7': return 7;
		case '8': return 8;
		case '9': return 9;
		case 'A': return 10;
		case 'B': return 11;
		case 'C': return 12;
		case 'D': return 13;
		case 'E': return 14;
		case 'F': return 15;
		case 'G': return 16;
		case 'H': return 17;
		case 'I': return 18;
		case 'J': return 19;
		case 'K': return 20;
		case 'L': return 21;
		case 'M': return 22;
		case 'N': return 23;
		case 'O': return 24;
		case 'P': return 25;
		case 'Q': return 26;
		case 'R': return 27;
		case 'S': return 28;
		case 'T': return 29;
		case 'U': return 30;
		case 'V': return 31;
		case 'W': return 32;
		case 'X': return 33;
		case 'Y': return 34;
		case 'Z': return 35;
		case ' ': return 36;
		case '$': return 37;
		case '%': return 38;
		case '*': return 39;
		case '+': return 40;
		case '-': return 41;
		case '.': return 42;
		case '/': return 43;
		case ':': return 44;
	}
}

// Provides one of eight mask pattern functions
function maskPattern(n) {
	switch(n) {
		case 0: return (r,c) => {return (r+c)%2 === 0};
		case 1: return (r,c) => {return r%2 === 0};
		case 2: return (r,c) => {return c%3 === 0};
		case 3: return (r,c) => {return (r+c)%3 === 0};
		case 4: return (r,c) => {return (Math.floor(r/2)+Math.floor(c/3))%2 === 0};
		case 5: return (r,c) => {return (r*c)%2+(r*c)%3 === 0};
		case 6: return (r,c) => {return ((r*c)%2+(r*c)%3)%2 === 0};
		case 7: return (r,c) => {return ((r+c)%2+(r*c)%3)%2 === 0};
	}
}

// Adds format bits to qr code
function format(grid,mNum) {
	let info = '';

	// Adds level to info
	switch(level) {
		case 'LOW':
			info += '01';
			break;
		case 'MEDIUM':
			info += '00';
			break;
		case 'QUARTILE':
			info += '11';
			break;
		case 'HIGH':
			info += '10';
			break;
	}

	// Adds mask pattern index to info
	info += mNum.toString(2).padStart(3,'0');
	let poly = '10100110111';
	let cor = info.padEnd(15,'0').replace(/^0+/,'');

	// Creates 10 error correction bits
	while(cor.length > 10) {
		const p = poly.padEnd(cor.length,'0');
		let temp = '';
		for(let i = 0; i < cor.length; i++) {
			temp += (cor[i] ^ p[i]).toString();
		}
		cor = temp.replace(/^0+/,'');
	}

	info += cor.padStart(10,'0');
	cor = '';

	// Applies mask pattern to info
	for(let i = 0, x = '101010000010010'; i < info.length; i++) {
		cor += (info[i] ^ x[i]).toString();
	}
	//console.log('format: ' + info)

	function reader(c) {
		switch(c) {
			case '0': return false;
			case '1': return true;
		}
	}
	
	// Adds format info to qr code
	for(let i = 0; i < cor.length; i++) {
		switch(i) {
			case 0:
			case 1:
			case 2:
			case 3:
			case 4:
			case 5:
				grid[8][i] = reader(cor[i]);
				grid[size-i-1][8] = reader(cor[i]);
				break;
			case 6:
				grid[8][i+1] = reader(cor[i]);
				grid[size-i-1][8] = reader(cor[i]);
				break;
			case 7:
			case 8:
				grid[15-i][8] = reader(cor[i]);
				grid[8][size-15+i] = reader(cor[i]);
				break;
			case 9:
			case 10:
			case 11:
			case 12:
			case 13:
			case 14:
				grid[8][size-15+i] = reader(cor[i]);
				grid[14-i][8] = reader(cor[i]);
				break;
			
		}
	}
}

// Adds version bits to qr code if version >= 7
function versBlock() {
	let block;
	// Selects correct string for version
	switch (version) {
		case '7':
			block = '000111110010010100';
			break;
		case '8':
			block = '001000010110111100';
			break;
		case '9':
			block = '001001101010011001';
			break;
		case '10':
			block = '001010010011010011';
			break;
		case '11':
			block = '001011101111110110';
			break;
		case '12':
			block = '001100011101100010';
			break;
		case '13':
			block = '001101100001000111';
			break;
		case '14':
			block = '001110011000001101';
			break;
		case '15':
			block = '001111100100101000';
			break;
		case '16':
			block = '010000101101111000';
			break;
		case '17':
			block = '010001010001011101';
			break;
		case '18':
			block = '010010101000010111';
			break;
		case '19':
			block = '010011010100110010';
			break;
		case '20':
			block = '010100100110100110';
			break;
		case '21':
			block = '010101011010000011';
			break;
		case '22':
			block = '010110100011001001';
			break;
		case '23':
			block = '010111011111101100';
			break;
		case '24':
			block = '011000111011000100';
			break;
		case '25':
			block = '011001000111100001';
			break;
		case '26':
			block = '011010111110101011';
			break;
		case '27':
			block = '011011000010001110';
			break;
		case '28':
			block = '011100110000011010';
			break;
		case '29':
			block = '011101001100111111';
			break;
		case '30':
			block = '011110110101110101';
			break;
		case '31':
			block = '011111001001010000';
			break;
		case '32':
			block = '100000100111010101';
			break;
		case '33':
			block = '100001011011110000';
			break;
		case '34':
			block = '100010100010111010';
			break;
		case '35':
			block = '100011011110011111';
			break;
		case '36':
			block = '100100101100001011';
			break;
		case '37':
			block = '100101010000101110';
			break;
		case '38':
			block = '100110101001100100';
			break;
		case '39':
			block = '100111010101000001';
			break;
		case '40':
			block = '101000110001101001';
			break;
	}

	function reader(c) {
		switch(c) {
			case '0': return false;
			case '1': return true;
		}
	}

	// Adds version block to qr code
	for(let i = 0; i < 18; i++) {
		code[Math.floor(i/3)][i%3+size-11] = reader(block[17-i]);
		code[i%3+size-11][Math.floor(i/3)] = reader(block[17-i]);
	}
}

// Retrieves parameters for data and error correction codewords from csv file
async function errorCorrectionGuide() {
	let csvFilePath;
	// Chooses corresponding csv file for correction level
	switch(level) {
		case 'LOW':
			csvFilePath = './CSV_Tables/L_error_correction.csv';
			break;
		case 'MEDIUM':
			csvFilePath = './CSV_Tables/M_error_correction.csv';
			break;
		case 'QUARTILE':
			csvFilePath = './CSV_Tables/Q_error_correction.csv';
			break;
		case 'HIGH':
			csvFilePath = './CSV_Tables/H_error_correction.csv';
			break;
	}

	// Aquires error correction parameters based of level and version
	try {
		const csvData = (await fetchData(csvFilePath))[version-1];
		csvData[7] = csvData[7].split('\r')[0];
		//console.log(csvData);
		return csvData;
	} catch(error) {
		console.error('Error fetching or processing CSV data:', error);
	}
}

// Breaks stream into groups, blocks, and codewords
function poly() {
	let word = new Array(ecGuide[5] == 0 ? 1: 2);
	for(let i = 0, n = 0; i < word.length; i++) {
		word[i] = new Array(ecGuide[2*i+3]);
		for(let j = 0; j < ecGuide[2*i+3]; j++) {
			word[i][j] = [];
			for(let k = 0; k < ecGuide[2*i+4]; k++, n+=8) {
				word[i][j].push(parseInt(stream.substring(n,n+8),2));
				//console.log('i: %i, j: %i, k: %i',i,j,k);
			}
		}
	}

	console.log(word);
	return word;
}

// Produces the coefficients for generator polynomial at specified power
function coeff(pow, galoisPair) {
	let result = [1,1];

	for(let i = 1; i < pow; i++) {
		let left = [...result, 0];
		let right = [...result].map((el) => {
			let n = i + galoisPair.indexOf(el);
			if(n > 255) n %= 255;
			return galoisPair[n];
		});
		right = [0, ...right];
		for(let j = 0; j < left.length; j++)
			result[j] = left[j] ^ right[j];
	}

	//console.log('coeff: ' + result);
	return result;
}

// Produces a block of error correction words given lenght and block of codewords
async function division(messPoly, genLength) {
	// Produces a table of values for 2^n in the Galios Field 0-255
	const galoisPair = new Uint8Array(256);
	galoisPair[0] = 1;
	for(let i = 1, base = 1; i < 256; i++) {
		base *= 2;
		if(base > 255) base ^= 285;
		galoisPair[i] = base;
	}

	const genPoly = coeff(genLength, galoisPair);
	let denominator = new Array(genLength);

	//console.log('mes: ' + messPoly);
	//console.log('gen: ' + genPoly);

	for(let i = messPoly.length; i > 0; i--) {
		denominator = genPoly.map((x) => {
			x = galoisPair.indexOf(x);
			x += galoisPair.indexOf(messPoly[0]);
			if(x > 255) x %= 255;
			return galoisPair[x];
		});
		//console.log('denomninator: ' + denominator);

		for(;messPoly.length < genPoly.length;) messPoly.push(0);
		messPoly = messPoly.map((v,i) => {
			return v ^ denominator[i];
		});

		while(messPoly[1] == 0) {
			//console.log('Double zero');
			messPoly.shift();
			i--;
		}
		messPoly.shift();
		//console.log(messPoly);
	}
	
	return messPoly;
}

// Interleave blocks of codewords into a single array
function interleaveData() {
	if(ecGuide[3] + ecGuide[5] == 1)
		return codewords[0][0];

	const words = [];
	const m = Math.max(ecGuide[4],ecGuide[6]);

	for(let i = 0; i < m; i++) {
		for(let j = 0; j < ecGuide[3] && i < ecGuide[4]; j++) {
			words.push(codewords[0][j][i]);
		}
		for(let j = 0; j < ecGuide[5] && i < ecGuide[6]; j++) {
			words.push(codewords[1][j][i]);
		}
	}

	return words;
}

// Interleave blocks of error correction words into a single array
function interleaveError() {
	const blocks = parseInt(ecGuide[3]) + parseInt(ecGuide[5]);
	const words = [];

	for(let i = 0; i < ecGuide[2]; i++) {
		for(let j = 0; j < blocks; j++)
			words.push(ecwords[j][i]);
	}

	//console.log(words.map((x) => parseInt(x).toString(16).padStart(2,'0')));
	return words;
}

// Place message and error correction into qrcode
async function dataPlacement(mN) {
	let data = totalWords.join('');
	let x = size-1, y = size-1;
	const mask = maskPattern(mN);
	const grid = [];

	// Deep copies code to local variable
	for(let i = 0; i < size; i++) {
		grid[i] = [...code[i]];
	}
	format(grid,mN);
	
	// Adds '0' bits based on version
	switch(version) {
		case '2':
		case '3':
		case '4':
		case '5':
		case '6':
			data += '0000000';
			break;
		case '21':
		case '22':
		case '23':
		case '24':
		case '25':
		case '26':
		case '27':
			data += '0000';
			break;
		case '14':
		case '15':
		case '16':
		case '17':
		case '18':
		case '19':
		case '20':
		case '28':
		case '29':
		case '30':
		case '31':
		case '32':
		case '33':
		case '34':
			data += '000';
			break;
	}

	// Applies mask pattern to bit
	function translate(a, b, c) {
		let m = mask(a,b);
		switch(c) {
			case '0': return m;
			case '1': return !m;
		}
	}

	// Places masked data and correction bits onto grid in correct order
	for(let i = 0, moves = 0, dv = -1; i < data.length; moves++) {
		//console.log('x: %i\ty: %i',x,y);
		if(grid[y][x] == null) {
			//console.log('d: %s',translate(x,y,data[i]).toString());
			//console.log('i: %i\tx: %i\ty: %i', i, x, y)
			grid[y][x] = translate(y,x,data[i++]);
		}

		if(moves >= 2*size-1) {
			moves = -1 ;
			x -= 1;
			if(x == 6 || x == 5) x -= 1;
			dv *= -1;
		} else {
			switch(moves%2) {
			case 0:
				x--;
				break;
			case 1:
				x++;
				y += dv;
				break;
			}
		}
	}

	//console.log('mask: ', mN);
	return [mN, grid];
}

// Determines the readability of qr code with current mask pattern
function penalty(mN, grid) {
	let score = 0;

	// 3pts for every 5 identical bits in a row
	for(let k = 0; k < size; k++) {
		for(let i = 1, cx = 0, cy = 0; i < size; i++) {
			if(grid[k][i] == grid[k][i-1]) cx++;
			else cx = 0;

			if(cx == 4) score += 3;
			else if(cx > 4) score ++;

			if(grid[i][k] == grid[i-1][k]) cy++;
			else cy = 0;

			if(cy == 4) score += 3;
			else if(cy > 4) score ++;
		}
	}

	// 3pts for every 2x2 block of identical bits
	for(let k = 1; k < size; k++) {
		for(let i = 1; i < size; i++) {
			if(grid[k][i] == grid[k][i-1] == grid[k-1][i] == grid[k-1][i-1])
				score += 3;
		}
	}

	// 40pts for the patterns 10111010000 and 00001011101
	const con1 = 'true,false,true,true,true,false,true,false,false,false,false';
	const con2 = 'false,false,false,false,true,false,true,true,true,false,true';
	for(let k = 0; k < size; k++) {
		score += 40 * Array.from(grid[k].toString().matchAll(con1)).length;
		score += 40 * Array.from(grid[k].toString().matchAll(con2)).length;
		let line = grid.map((x) => {return x[0]});
		score += 40 * Array.from(line.toString().matchAll(con1)).length;
		score += 40 * Array.from(line.toString().matchAll(con2)).length;
	}

	// pts based on the ratio of true bits to false bits
	let t = 0;
	grid.forEach((u) => u.forEach((f) => {if(f == true) t++}));
	t = t / size**2 * 100;
	t = Math.floor(t / 5) * 5;
	let s = Math.abs(t - 45) / 5;
	t = Math.abs(t-50) / 5;
	score += Math.min(t,s);

	return [mN, grid, score];
}