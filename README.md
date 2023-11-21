# jsvm

A "javascript" "vm" project. Currently this is very imcomplete, but the goal for this project is to create something that turns a subset of javascript into some preexisting bytecode format.


## Goals
- [ ] Run javascript
- [ ] Run typescript
- [ ] Optimizations
	- [ ] Detect monomorphic object literals and convert them into simple structs 
		- [ ] Potenially create parent and children relationships between similar objects used in the same places
			- Example: `{ a: 1, b: 3 }` `{ a: 1 }` could be placed in the same container in some circumstances  
	- [ ] Detect strings used as enums
		- Might be very difficult to impossible once the input code is large enough
	- [ ] Double -> Float -> Int -> Byte when possible 
	- [ ] Purity checks?
	- [ ] Turn datatypes into what they should be, i.e List -> Stack, Object -> Map, Object -> Set, etc.
