# jsvm

A "javascript" "vm" project. Currently this is very imcomplete, but the goal for this project is to create something that turns a subset of javascript into jvm bytecode currently, but eventually different formats as well.

## Rationale
This project came about as somewhat a joke (js -> java) and somewhat something I've really wanted to do for a large period of time. I've noticed in the Javascript ecosystem many people will ignore performance as a whole, leading to the overbloated and incredibly slow web (especially on lower end machines). This project, in a sense, seeks to remedy some of that, and make the web (or nodejs, etc.) faster and more versitile. 

## Goals
Eventually, I want this project to be completely compatible with all of javascript and beat V8 in terms of performance due to more strict typing, and other optimizations V8 simply can't make at runtime because of their cost.

## Roadmap
Any features with a empty checkbox means they are currently in progress, any fully checked checkbox means the feature is complete (though might have bugs). 

- [ ] Parse javascript
	- [ ] Statements
		- [x] Variable declarations
			- [x] `let`, `const`, `var`
			- [ ] Destructuring
		- [x] `if`
		- [x] `for`
		- [ ] `for .. in`
		- [ ] `for .. of`
		- [ ] `while`
		- [ ] `do .. while`
		- [ ] `try .. catch`
		- [ ] `try .. catch .. finally`
		- [ ] `switch`
	- [ ] Expresions 
		- [x] Assignment
			- [x] Increment/Decrement  
		- [x] Arithmetic
		- [x] Logical
		- [x] Binary
		- [x] Comparision
		- [x] Ternary
		- [x] `typeof`
		- [ ] `instanceof` 
		- [ ] Primatives
			- [x] Number
			- [x] String
			- [x] Boolean
			- [x] Object
			- [x] Array
			- [ ] Undefined
			- [ ] Null
			- [ ] Symbol
	- [ ] Constructions
		- [ ] Classes
			- [ ] Fields
			- [ ] Methods
			- [ ] Access modifiers
		- [ ] Functions
			- [ ] Arguments
				- [ ] General
				- [ ] Rest
				- [ ] Default
			- [ ] Arrow
			- [ ] Generator
- [x] Run javascript
	- [x] Primative Types
		- [x] Number
		- [x] Boolean
		- [x] String
	- [x] Arithmetic
	- [ ] Functions
		- [ ] Return
	- [x] Variables
		- [ ] Scoping
	- [ ] Control flow
		- [x] If
		- [ ] Loops
			- [x] For
			- [ ] While
			- [ ] Break
			- [ ] Continue
	<!-- Future goals -->
	- [ ] Collections
		- [ ] Array
		- [ ] Object
	- [ ] Operators
		- [ ] Typeof 
		- [ ] Instanceof
	- [ ] Prototypes
	- [ ] Finish Types
		- [ ] Symbol
		- [ ] Bigint
		- [ ] Undefined
		- [ ] Null
	- [ ] Arrow functions
	- [ ] Async
	- [ ] Anything else to pass [test262](https://github.com/tc39/test262)
- [ ] Optimizations
	- [ ] Detect monomorphic object literals and convert them into simple structs 
		- [ ] Potenially create parent and children relationships between similar objects used in the same places
			- Example: `{ a: 1, b: 3 }` `{ a: 1 }` could be placed in the same container in some circumstances with instanceof checks as necessary 
	- [ ] Detect strings used as enums
		- Might be very difficult to impossible once the input code is large enough
	- [ ] Double -> Float -> Int -> Byte when possible 
	- [ ] Purity checks?
	- [ ] Turn datatypes into what they should be, i.e List -> Stack, Object -> Map, Object -> Set, etc.
- [ ] Run typescript

## Sources Referenced
- https://docs.oracle.com/javase/specs/jvms/se8/html/index.html
	- Complete JVM specification
- https://rosettacode.org/wiki/Category:Basic_language_learning
	- For examples to use as tests
- https://developer.mozilla.org/en-US/
	- To reference various Javascript quirks quickly 
- https://tc39.es/ecma262/
	- To reference various Javascript quirks, slowly 