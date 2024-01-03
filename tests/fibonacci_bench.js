let t1 = 0;
let t2 = 0;
let nextTerm = 0;

for (let ii = 0; ii < 100000; ii++) {
	t1 = 0;
	t2 = 1;
	nextTerm = t1 + t2;
	// print(t1);
	// print(t2);

	for (let i = 3; i <= 100000; i++) {
		// print(nextTerm);
		t1 = t2;
		t2 = nextTerm;
		nextTerm = t1 + t2;
	}
}
