// Print the first 20 terms of the Fibonacci sequence

let t1 = 0;
let t2 = 1;
let nextTerm = t1 + t2;

print(t1);
print(t2);

for (let i = 3; i <= 20; i++) {
	print(nextTerm);
	t1 = t2;
	t2 = nextTerm;
	nextTerm = t1 + t2;
}