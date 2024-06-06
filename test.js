function galios() {
	let galoisPair = [1];
	for(let i = 1, base = 1; i < 256; i++) {
		base *= 2;
		if(base > 255) base ^= 285;
		galoisPair[i] = base;
	}
	return galoisPair;
} 

function coeff(pow) {
	let galoisPair = galios();
	let result = [1];
	let c = [];
	let r = 0;

	function combine(start,term,end) {
		if(c.length === term) {
			let sum = 0;
			c.forEach(el => {sum += el;});
			sum = galoisPair[sum];

			//console.log('r: %i, c: %o', sum, c);
			r ^= sum;
			return;
		}

		for(let i = start; i < end; i++) {
			c.push(i);
			combine(i+1,term,end);
			c.pop();
		}
	}

	for(let i = 1; i <= pow; i++) {
		combine(0,i,pow);
		result.push(r);
		c = [];
		r = 0;
	}
	return result;
}

// let messPoly = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
function division(messPoly, genLength) {
	let galoisPair = galios();
	let genPoly = coeff(genLength);
	let denominator = new Array(genLength);

	console.log(messPoly);
	console.log(genPoly);

	for(let i = messPoly.length; i > 0; i--) {
		denominator = genPoly.map((x) => {
			x = galoisPair.indexOf(x);
			x += galoisPair.indexOf(messPoly[0]);
			if(x > 255) x %= 255;
			return galoisPair[x];
		});
		console.log('denomninator: ' + denominator);

		if(messPoly.length < genPoly.length) messPoly.push(0);
		messPoly = messPoly.map((v,i) => {
			return v ^ denominator[i];
		});

		messPoly.shift();
		console.log('messPoly: ' + messPoly + '\n');
	}
	
	return messPoly;
}