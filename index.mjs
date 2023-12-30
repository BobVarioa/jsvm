import { EBNF, EBNFAst, EBNFTokenizer } from "./bnf/index.mjs";
import {
	ClassFile,
	AccessFlags,
	ReferenceKind,
	VerificationTypeInfo,
} from "./jvm/index.mjs";
import fs from "node:fs";
import process from "node:process";

class AstWalker {
	/**
	 * @type {ClassFile}
	 */
	cf;

	code = [];

	variables = {};

	constructor(cf) {
		this.cf = cf;
	}

	declaration(node) {
		let code = [];

		switch (node.kind) {
			// TODO : scoping, lift up variables and the like
			case "var":
			case "let": {
				const expr = this.expression(node.expr);
				this.variables[node.name] = {
					type: expr.type,
					immutable: false,
				};
				code.push(...expr.code);
				code.push({
					op: "store",
					name: node.name,
					type: expr.type,
				});
				break;
			}
			case "const": {
				const expr = this.expression(node.expr);
				this.variables[node.name] = {
					type: expr.type,
					immutable: true,
				};
				code.push(...expr.code);
				code.push({
					op: "store",
					name: node.name,
					type: expr.type,
				});
				break;
			}
		}

		return { code };
	}

	expression(node) {
		let code = [];
		let ret = {};
		switch (node.kind) {
			case "unary_front":
				let expr = this.expression(node.expr);
				switch (node.op) {
					case "!":
						if (expr.type != "boolean") throw new Error("type");
						ret = { type: "boolean" };
						code.push({ op: "logical_not" });
						break;
					case "++":
						if (node.expr.kind == "variable") {
							const { name } = node.expr;
							let data = this.variables[name];
							if (data.immutable) throw new Error("immutable");

							if (
								data.type == "string" ||
								data.type == "boolean"
							) {
								throw new Error("type");
							}

							let type = data.type;
							ret.type = type;
							code.push(
								{ op: "load", type, name },
								{ op: type, value: 1 },
								{ op: "add", type },
								{ op: "dup" },
								{ op: "store", type, name }
							);
							break;
						}
						throw new Error("");
					case "--":
						if (node.expr.kind == "variable") {
							const { name } = node.expr;
							let data = this.variables[name];
							if (data.immutable) throw new Error("immutable");

							if (
								data.type == "string" ||
								data.type == "boolean"
							) {
								throw new Error("type");
							}

							let type = data.type;
							ret.type = type;
							code.push(
								{ op: "load", type, name },
								{ op: type, value: -1 },
								{ op: "add", type },
								{ op: "dup" },
								{ op: "store", type, name }
							);
							break;
						}
						throw new Error("");
					case "+":
						if (expr.type == "string" || expr.type == "boolean")
							throw new Error("type");
						return expr;
					case "-":
						if (expr.type == "string" || expr.type == "boolean")
							throw new Error("type");

						if (expr.value) {
							ret = { type: expr.type, value: -expr.value };
							code.push({ op: expr.type, value: -expr.value });
							break;
						}
						code.push(...expr.code, {
							op: "negate",
							type: expr.type,
						});
						ret = { type: expr.type };
						break;
					case "~":
						if (expr.type == "string" || expr.type == "boolean")
							throw new Error("type");

						if (expr.value) {
							ret = { type: expr.type, value: ~expr.value };
							code.push({ op: "int", value: ~expr.value });
							break;
						}
						code.push(...expr.code);
						if (expr.type == "float") {
							code.push({ op: "cast", from: "float", to: "int" });
						}
						code.push({ op: "not" });
						ret = { type: "int" };
						break;
					default:
						throw new Error();
				}
				break;
			case "decrement_back": {
				const name = node.name;
				let data = this.variables[name];
				if (data.immutable) throw new Error("immutable");

				if (data.type == "string" || data.type == "boolean") {
					throw new Error("type");
				}

				let type = data.type;
				ret.type = type;
				code.push(
					{ op: "load", type, name },
					{ op: "dup" },
					{ op: type, value: -1 },
					{ op: "add", type },
					{ op: "store", type, name }
				);
				break;
			}
			case "increment_back": {
				const name = node.name;
				let data = this.variables[name];
				if (data.immutable) throw new Error("immutable");

				if (data.type == "string" || data.type == "boolean") {
					throw new Error("type");
				}

				let type = data.type;
				ret.type = type;
				code.push(
					{ op: "load", type, name },
					{ op: "dup" },
					{ op: type, value: 1 },
					{ op: "add", type },
					{ op: "store", type, name }
				);
				break;
			}

			case "number": {
				const value = parseFloat(node.value);
				if (value % 1 == 0) {
					code.push({ op: "int", value });
					ret = { type: "int", value };
				} else {
					code.push({ op: "float", value });
					ret = { type: "float", value };
				}
				break;
			}
			case "string": {
				const value = node.value.slice(1, -1);
				code.push({ op: "string", value });
				ret = { type: "string", value };
				break;
			}
			case "boolean": {
				const value = node.value == "true" ? true : false;
				code.push({
					op: "boolean",
					value,
				});
				ret = { type: "boolean", value };
				break;
			}
			case "group":
				return this.expression(node.expr);
			case "variable":
				code.push({
					op: "load",
					name: node.name,
					type: this.variables[node.name].type,
				});
				ret = { type: this.variables[node.name].type, name: node.name };
				break;
			case "binop": {
				let lhs = this.expression(node.lhs);
				let rhs = this.expression(node.rhs);
				switch (node.op) {
					case "/":
						if (
							lhs.type == "string" ||
							rhs.type == "string" ||
							lhs.type == "boolean" ||
							rhs.type == "boolean"
						) {
							throw new Error("type");
						}

						if (
							typeof lhs.value !== "undefined" &&
							typeof rhs.value !== "undefined"
						) {
							let value = lhs.value / rhs.value;
							code.push({ op: "float", value });
							ret = { type: "float", value };
							break;
						}

						if (lhs.type == "int" && rhs.type == "int") {
							code.push(
								...lhs.code,
								{ op: "cast", from: "int", to: "float" },
								...rhs.code,
								{ op: "cast", from: "int", to: "float" }
							);
						} else if (lhs.type == "int" && rhs.type == "float") {
							code.push(
								...lhs.code,
								{ op: "cast", from: "int", to: "float" },
								...rhs.code
							);
						} else if (lhs.type == "float" && rhs.type == "int") {
							code.push(...lhs.code, ...rhs.code, {
								op: "cast",
								from: "int",
								to: "float",
							});
						} else {
							throw new Error();
						}
						ret = { type: "float" };
						code.push({ op: "div", type: "float" });
						break;

					case "**":
					case "*":
					case "+":
					case "-": {
						if (lhs.type == "string" || rhs.type == "string") {
							if (
								lhs.type == "string" &&
								rhs.type == "string" &&
								node.op == "+"
							) {
								if (
									typeof lhs.value !== "undefined" &&
									typeof rhs.value !== "undefined"
								) {
									const value = lhs.value + rhs.value;
									ret = { type: "string", value };
									code.push({ op: "string", value });
									break;
								}
								code.push(...lhs.code, ...rhs.code, {
									op: "concat",
								});
								break;
							}
							throw new Error("type");
						}

						if (
							typeof lhs.value !== "undefined" &&
							typeof rhs.value !== "undefined"
						) {
							let value;
							if (node.op == "+") value = lhs.value + rhs.value;
							if (node.op == "-") value = lhs.value - rhs.value;
							if (node.op == "*") value = lhs.value * rhs.value;
							if (node.op == "**") value = lhs.value ** rhs.value;
							if (lhs.type == "float" || rhs.type == "float") {
								code.push({ op: "float", value });
								ret = { type: "float", value };
								break;
							}
							code.push({ op: "int", value });
							ret = { type: "int", value };
							break;
						}

						let type;
						if (lhs.type == "int" && rhs.type == "int") {
							code.push(...lhs.code, ...rhs.code);
							type = "int";
						} else if (lhs.type == "int" && rhs.type == "float") {
							code.push(
								...lhs.code,
								{ op: "cast", from: "int", to: "float" },
								...rhs.code
							);
							type = "float";
						} else if (lhs.type == "float" && rhs.type == "int") {
							code.push(...lhs.code, ...rhs.code, {
								op: "cast",
								from: "int",
								to: "float",
							});
							type = "float";
						} else {
							throw new Error("type");
						}
						ret = { type };
						if (node.op == "+") code.push({ op: "add", type });
						if (node.op == "-") code.push({ op: "sub", type });
						if (node.op == "*") code.push({ op: "mult", type });
						if (node.op == "**") code.push({ op: "expon", type });
						break;
					}
					case "&&":
					case "||": {
						if (lhs.type == "boolean" && rhs.type == "boolean") {
							if (
								typeof lhs.value !== "undefined" &&
								typeof rhs.value !== "undefined"
							) {
								let value;
								if (node.op == "&&")
									value = lhs.value && rhs.value;
								if (node.op == "||")
									value = lhs.value || rhs.value;
								code.push({ op: "boolean", value });
								ret = { type: "boolean", value };
								break;
							}
							ret = { type: "boolean" };
							code.push(...lhs.code, ...rhs.code);
							if (node.op == "&&")
								code.push({ op: "logical_and" });
							if (node.op == "||")
								code.push({ op: "logical_or" });
							break;
						}
						throw new Error("type");
					}
					case "&":
					case "|":
					case "^":
					case ">>>":
					case "<<":
					case ">>":
					case "%": {
						// TODO: bitwise ops are always casted to a 32 bit int in js
						if (
							lhs.type == "boolean" ||
							rhs.type == "boolean" ||
							lhs.type == "string" ||
							rhs.type == "string"
						) {
							throw new Error("type");
						}

						if (
							typeof lhs.value !== "undefined" &&
							typeof rhs.value !== "undefined"
						) {
							let value;
							if (node.op == "&") value = lhs.value & rhs.value;
							if (node.op == "|") value = lhs.value | rhs.value;
							if (node.op == "^") value = lhs.value ^ rhs.value;
							if (node.op == ">>>")
								value = lhs.value >>> rhs.value;
							if (node.op == "<<") value = lhs.value << rhs.value;
							if (node.op == ">>") value = lhs.value >> rhs.value;
							if (node.op == "%") value = lhs.value % rhs.value;
							code.push({ op: "int", value });
							ret = { type: "int", value };
							break;
						}

						code.push(...lhs.code);
						if (lhs.type == "float") {
							code.push({
								op: "cast",
								from: "float",
								to: "int",
							});
						}
						code.push(...rhs.code);
						if (rhs.type == "float") {
							code.push({
								op: "cast",
								from: "float",
								to: "int",
							});
						}

						ret = { type: "int" };
						if (node.op == "&") code.push({ op: "and" });
						if (node.op == "|") code.push({ op: "or" });
						if (node.op == "^") code.push({ op: "xor" });
						if (node.op == ">>>")
							code.push({ op: "unsigned_right_shift" });
						if (node.op == "<<") code.push({ op: "left_shift" });
						if (node.op == ">>") code.push({ op: "right_shift" });
						if (node.op == "%") code.push({ op: "mod" });
						break;
					}
					case ">=":
					case "<=":
					case ">":
					case "<":
					case "==":
					case "!=":
					case "===":
					case "!==": {
						if (
							(lhs.type == "string" ||
								rhs.type == "string" ||
								lhs.type == "boolean" ||
								rhs.type == "boolean") &&
							!(
								node.op == "==" ||
								node.op == "===" ||
								node.op == "!=" ||
								node.op == "!=="
							)
						) {
							// TODO: strings are converted to ascii codes and then compared that way, only to other strings tho
							throw new Error("type");
						}
						if (
							typeof lhs.value !== "undefined" &&
							typeof rhs.value !== "undefined"
						) {
							let value;
							if (node.op == ">=") value = lhs.value >= rhs.value;
							if (node.op == "<=") value = lhs.value <= rhs.value;
							if (node.op == ">") value = lhs.value > rhs.value;
							if (node.op == "<") value = lhs.value < rhs.value;
							if (node.op == "==") value = lhs.value == rhs.value;
							if (node.op == "!=") value = lhs.value != rhs.value;
							if (node.op == "===")
								value = lhs.value === rhs.value;
							if (node.op == "!==")
								value = lhs.value !== rhs.value;
							code.push({ op: "boolean", value });
							ret = { type: "boolean", value };
							break;
						}

						let type = lhs.type;
						code.push(...lhs.code, ...rhs.code);
						if (rhs.type != lhs.type) {
							// TODO: read below, js type shenanigans
							/*
							Okay, so, js does a low of type coercion on everything but === and !==.
							In fact, there is no strict way to compare values besides equality. 
							MDN link here: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Less_than
							
							This definitely is behavior that should be disabled with a weird flag (`-wStrictOps` ?) but right now
							I'm just gonna assume operators are strict by default 😓 (numbers being cast as necessary)
							*/

							code.push({
								op: "cast",
								from: lhs.type,
								to: rhs.type,
							});
						}
						if (node.op == ">=") code.push({ op: "gt_eq", type });
						if (node.op == "<=") code.push({ op: "lt_eq", type });
						if (node.op == ">") code.push({ op: "gt", type });
						if (node.op == "<") code.push({ op: "lt", type });
						if (node.op == "==") code.push({ op: "eq", type });
						if (node.op == "!=") code.push({ op: "neq", type });
						if (node.op == "===") code.push({ op: "eq", type });
						if (node.op == "!==") code.push({ op: "neq", type });
						ret = { type: "boolean" };
						break;
					}

					default:
						throw new Error();
				}
				break;
			}
			case "call": {
				const expr = this.expression(node.last);
				code.push({ op: "get_method", name: node.name }, ...expr.code, {
					op: "call",
					name: node.name,
					args: [expr.type],
				});
				ret = { type: "void" };
				break;
			}
			case "assign":
				let data = this.variables[node.name];
				if (data.immutable) throw new Error();
				if (node.op == "=") {
					const expr = this.expression(node.expr);
					code.push(...expr.code);
					if (expr.type != data.type) {
						code.push({
							op: "cast",
							from: e.type,
							to: data.type,
						});
					}
					code.push(
						{ op: "dup" },
						{
							op: "store",
							name: node.name,
							type: data.type,
						}
					);
					ret = { type: data.type };
					break;
				}
				const e = this.expression({
					kind: "binop",
					lhs: { kind: "variable", name: node.name },
					op: node.op.slice(0, -1),
					rhs: node.expr,
				});
				code.push(...e.code);
				if (e.type != data.type) {
					code.push({ op: "cast", from: e.type, to: data.type });
				}
				code.push(
					{ op: "dup" },
					{
						op: "store",
						name: node.name,
						type: data.type,
					}
				);
				ret = { type: data.type };
				break;
			default:
				throw new Error();
		}

		ret.code = code;
		return ret;
	}

	if(node) {
		let body = [];
		for (const c of node.body) {
			body.push(...this.statement(c).code);
		}

		let code = [];
		let expr = this.expression(node.expr);
		if (expr.type == "boolean" && typeof expr.value == "boolean") {
			if (!expr.value) return { code: [] };
			return { code: body };
		}
		code.push(
			...expr.code,
			{ op: "if_false", jump: body.length + 1 },
			...body
		);

		return { code };
	}

	for(node) {
		let code = [];
		let init;
		if (node.init.type.has("declaration")) {
			init = this.declaration(node.init);
		} else {
			init = this.expressionStatement(node.init);
		}
		let test = this.expression(node.test);
		let after = this.expressionStatement(node.after);

		let body = [];
		for (const c of node.body) {
			body.push(...this.statement(c).code);
		}

		code.push(...init.code);

		code.push(
			...test.code,
			{ op: "if_false", jump: body.length + 1 + after.code.length + 1 },
			...body,
			...after.code,
			{
				op: "jump",
				index: -(
					after.code.length +
					body.length +
					1 +
					test.code.length
				),
			}
		);

		return { code };
	}

	expressionStatement(node) {
		let code = [];
		const expr = this.expression(node);
		code.push(...expr.code);
		if (expr.type != "void") code.push({ op: "discard" });
		return { code };
	}

	statement(node) {
		let code = [];
		switch (node.kind) {
			case "declaration":
				code.push(...this.declaration(node.content).code);
				break;
			case "expression":
				code.push(...this.expressionStatement(node.content).code);
				break;
			case "if":
				// TODO: truthy and falsy bs
				code.push(...this.if(node).code);
				break;
			case "for":
				code.push(...this.for(node).code);
				break;
			default:
				throw "wut the hell dude";
		}

		return { code };
	}

	file(node) {
		if (node.kind != "file") throw "wut the hell dude";

		let code = [];

		for (const c of node.content) {
			code.push(...this.statement(c).code);
		}

		return {
			code,
			variables: this.variables,
		};
	}
}

class Interpreter {
	constructor() {}

	static ops = {
		add: (a, b) => a + b,
		sub: (a, b) => a - b,
		div: (a, b) => a / b,
		mult: (a, b) => a * b,
		mod: (a, b) => a % b,
		expon: (a, b) => a ** b,
		eq: (a, b) => a == b,
		neq: (a, b) => a != b,
		gt: (a, b) => a > b,
		lt: (a, b) => a < b,
		gt_eq: (a, b) => a >= b,
		lt_eq: (a, b) => a <= b,
		and: (a, b) => a & b,
		or: (a, b) => a | b,
		xor: (a, b) => a ^ b,
		left_shift: (a, b) => a << b,
		right_shift: (a, b) => a >> b,
		unsigned_right_shift: (a, b) => a >>> b,
		concat: (a, b) => a + b,
		logical_and: (a, b) => a && b,
		logical_or: (a, b) => a || b,
	};

	run(code) {
		let stack = [];
		let vars = {};

		for (let i = 0; i < code.length; i++) {
			let ins = code[i];

			switch (ins.op) {
				case "int":
				case "float":
				case "string":
				case "boolean":
					stack.push(ins.value);
					break;

				case "store":
					vars[ins.name] = stack.pop();
					break;

				case "load":
					stack.push(vars[ins.name]);
					break;

				case "discard":
					stack.pop();
					break;

				case "not":
					stack.push(~stack.pop());
					break;

				case "logical_not":
					stack.push(!stack.pop());
					break;

				case "if_false":
					if (stack.pop() == false) {
						i += ins.jump - 1;
					}
					break;

				case "jump":
					i += ins.index - 1;
					break;

				case "call":
					if (ins.name != "print") throw new Error();
					console.log(stack.pop());
					break;

				case "dup":
					stack.push(stack.at(-1));
					break;

				case "swap":
					let b = stack.pop();
					let a = stack.pop();
					stack.push(a, b);
					break;

				case "cast":
					break;

				default:
					if (typeof Interpreter.ops[ins.op] != "undefined") {
						let rhs = stack.pop();
						let lhs = stack.pop();
						stack.push(Interpreter.ops[ins.op](lhs, rhs));
						break;
					}

					throw new Error();
			}
		}
	}
}

class ClassFileBuilder {
	run(className, file, code, variables) {
		const cf = new ClassFile();

		cf.access_flags = AccessFlags.File_Public | AccessFlags.File_Super;

		cf.setSuperClass("java.lang.Object");
		cf.setThisClass(className);

		const objectNew = cf.createMethodRef(
			"java.lang.Object",
			"<init>",
			"void",
			[]
		);

		cf.addMethod(
			AccessFlags.Method_Public,
			"<init>",
			"void",
			[],
			[
				cf.createCode(1, 1, [
					cf.createBytecode("aload_0"), // this obj
					cf.createBytecode("invokespecial", objectNew), // super()
					cf.createBytecode("return"),
				]),
			]
		);

		cf.addAttribute(cf.createAttribute("SourceFile", cf.createUtf8(file)));

		// TODO: sigh... deep copy proper later
		let vars = JSON.parse(JSON.stringify(variables));

		for (let i = 0; i < code.length; i++) {
			let ins = code[i];

			switch (ins.op) {
				case "store":
					vars[ins.name].weight ??= 0;
					vars[ins.name].weight += 1;
					break;

				case "load":
					vars[ins.name].weight ??= 0;
					vars[ins.name].weight += 2;
					// NOTE: arbitrary decision, loads are probably twice as important as stores
					break;

				default:
					break;
			}
		}

		let maxLocals = 1; // inital argument
		let varsWeighted = Object.fromEntries(
			Object.entries(vars)
				.toSorted((a, b) => a[1].weight - b[1].weight)
				.map((v, i) => {
					v[1].index = i + 1;
					maxLocals++;
					return v;
				})
		);

		function ldc(index) {
			if (index > 255) {
				return cf.createBytecode("ldc_w", index);
			}
			return cf.createBytecode("ldc", index);
		}

		let usedConcat = false;
		let StringConcat = () => {
			if (!usedConcat) {
				cf.addInnerClass(
					"java.lang.invoke.MethodHandles",
					"Lookup",
					AccessFlags.Class_Public |
						AccessFlags.Class_Static |
						AccessFlags.Class_Final
				);
				usedConcat = true;
			}
			return cf.createInvokeDynamic(
				"makeConcatWithConstants",
				"java.lang.String",
				["java.lang.String", "java.lang.String"],
				"invokeStatic",
				"java.lang.invoke.StringConcatFactory",
				"makeConcatWithConstants",
				"java.lang.invoke.CallSite",
				[
					"java.lang.invoke.MethodHandles$Lookup",
					"java.lang.String",
					"java.lang.invoke.MethodType",
					"java.lang.String",
					"java.lang.Object[]",
				],
				[cf.createString("\u0001\u0001")]
			);
		};

		const systemOut = cf.createFieldRef(
			"java.lang.System",
			"out",
			"java.io.PrintStream"
		);

		const printlnString = cf.createMethodRef(
			"java.io.PrintStream",
			"println",
			"void",
			["java.lang.String"]
		);

		const printlnInt = cf.createMethodRef(
			"java.io.PrintStream",
			"println",
			"void",
			["int"]
		);

		const printlnFloat = cf.createMethodRef(
			"java.io.PrintStream",
			"println",
			"void",
			["float"]
		);

		const printlnBoolean = cf.createMethodRef(
			"java.io.PrintStream",
			"println",
			"void",
			["boolean"]
		);

		let queue = [];

		let locals = [cf.createVerficationType("Object", "java.lang.String[]")];
		let stack = [];

		let stackmapframes = [];
		let currentOffset = 0;
		function createStackMapFrame(now) {
			let llocals = [...locals]; // shallow copy should be okay
			let sstack = [...stack]; // shallow copy should be okay
			queue.push(() => {
				let lens = body.slice(0, now + 1);
				let offset = -1; // because this needs to happen not at the next instruction but before it
				for (const ele of lens) {
					for (const c of ele) {
						offset += c.size + 1;
					}
				}
				stackmapframes.push(
					cf.createStackMapFrame(
						"FULL_FRAME",
						offset - currentOffset,
						llocals,
						sstack
					)
				);
				currentOffset += offset;
			});
		}

		let maxStack = 0;
		/**
		 *
		 * @param {keyof VerificationTypeInfo} tag
		 * @param {string} type
		 */
		function stackPush(tag, type) {
			stack.push(cf.createVerficationType(tag, type));
			if (stack.length > maxStack) {
				maxStack = stack.length;
			}
		}

		function stackPop() {
			stack.pop();
		}

		let body = [];
		for (let i = 0; i < code.length; i++) {
			let instructs = [];
			let ins = code[i];

			switch (ins.op) {
				case "int":
					stackPush("Integer");
					// prettier-ignore
					switch (ins.value) {
						case -1: instructs.push(cf.createBytecode("iconst_m1")); break;
						case 0:  instructs.push(cf.createBytecode("iconst_0")); break;
						case 1:  instructs.push(cf.createBytecode("iconst_1")); break;
						case 2:  instructs.push(cf.createBytecode("iconst_2")); break;
						case 3:  instructs.push(cf.createBytecode("iconst_3")); break;
						case 4:  instructs.push(cf.createBytecode("iconst_4")); break;
						case 5:  instructs.push(cf.createBytecode("iconst_5")); break;
						default: instructs.push(ldc(cf.addConstant("Integer", ins.value))); break;
					}
					break;
				case "float":
					stackPush("Float");
					// prettier-ignore
					switch (ins.value) {
						case 0:  instructs.push(cf.createBytecode("fconst_0")); break;
						case 1:  instructs.push(cf.createBytecode("fconst_1")); break;
						case 2:  instructs.push(cf.createBytecode("fconst_2")); break;
						default: instructs.push(ldc(cf.addConstant("Float", ins.value))); break;
					}
					break;
				case "string":
					stackPush(
						cf.createVerficationType("Object", "java.lang.String")
					);
					instructs.push(ldc(cf.createString(ins.value)));
					break;
				case "boolean":
					stackPush("Integer");
					switch (ins.value) {
						case true:
							instructs.push(cf.createBytecode("bipush", 1));
							break;
						case false:
							instructs.push(cf.createBytecode("bipush", 0));
							break;
					}
					break;
				case "load": {
					const data = varsWeighted[ins.name];
					let t;
					// prettier-ignore
					switch (data.type) {
						case "int":   t = "i"; stackPush("Integer"); break;
						case "boolean": t = "i"; stackPush("Integer"); break;
						case "float": t = "f"; stackPush("Float"); break;
						case "string": t = "a"; stackPush("Object", "java.lang.String"); break;
						default: throw new Error();
					}
					// prettier-ignore
					switch (data.index) {
						case 0:  instructs.push(cf.createBytecode(`${t}load_0`)); break;
						case 1:  instructs.push(cf.createBytecode(`${t}load_1`)); break;
						case 2:  instructs.push(cf.createBytecode(`${t}load_2`)); break;
						case 3:  instructs.push(cf.createBytecode(`${t}load_3`)); break;
						default: instructs.push(cf.createBytecode(`${t}load`, data.index));
					}
					break;
				}
				case "store":
					stackPop();
					const data = varsWeighted[ins.name];
					let t;
					// prettier-ignore
					switch (data.type) {
						case "int":   t = "i"; locals.push(cf.createVerficationType("Integer")); break;
						case "boolean": t = "i"; locals.push(cf.createVerficationType("Integer")); break;
						case "float": t = "f"; locals.push(cf.createVerficationType("Float")); break;
						case "string": t = "a"; locals.push(cf.createVerficationType("Object", "java.lang.String")); break;
						default: throw new Error();
					}
					// prettier-ignore
					switch (data.index) {
						case 0:  instructs.push(cf.createBytecode(`${t}store_0`)); break;
						case 1:  instructs.push(cf.createBytecode(`${t}store_1`)); break;
						case 2:  instructs.push(cf.createBytecode(`${t}store_2`)); break;
						case 3:  instructs.push(cf.createBytecode(`${t}store_3`)); break;
						default: instructs.push(cf.createBytecode(`${t}store`, data.index)); break
					}

					break;
				case "discard":
					stackPop();
					instructs.push(cf.createBytecode("pop"));
					break;
				case "not":
					instructs.push(
						cf.createBytecode("iconst_m1"),
						cf.createBytecode("ixor")
					);
					stackPush("Integer");
					stackPop();
					stackPop();
					stackPush("Integer");
					break;
				case "logical_not":
					instructs.push(
						cf.createBytecode("iconst_1"),
						cf.createBytecode("ixor")
					);
					stackPush("Integer");
					stackPop();
					stackPop();
					stackPush("Integer");
					break;
				case "if_false": {
					stackPop();
					instructs.push({ size: 2 })
					if (ins.jump > 0) {
						let now = i;
						queue.push(() => {
							let lens = body.slice(now, now + ins.jump);
							let size = 0; // this size
							for (const ele of lens) {
								for (const c of ele) {
									size += c.size + 1;
								}
							}
							instructs.pop();
							instructs.push(cf.createBytecode("ifeq", size));
						});
					} else {
						let now = i;
						queue.push(() => {
							let lens = body.slice(now + ins.jump, now);
							let size = 0;
							for (const ele of lens) {
								for (const c of ele) {
									size += c.size + 1;
								}
							}
							instructs.pop();
							instructs.push(cf.createBytecode("ifeq", -size));
						});
					}

					break;
				}
				case "jump":
					instructs.push({ size: 2 })
					if (ins.index > 0) {
						let now = i;
						queue.push(() => {
							let lens = body.slice(now, now + ins.index);
							let size = 0; // this size
							for (const ele of lens) {
								for (const c of ele) {
									size += c.size + 1;
								}
							}
							instructs.pop();
							instructs.push(cf.createBytecode("goto", size));
						});
					} else {
						let now = i;
						queue.push(() => {
							let lens = body.slice(now + ins.index, now);
							let size = 0;
							for (const ele of lens) {
								for (const c of ele) {
									size += c.size + 1;
								}
							}
							instructs.pop();
							instructs.push(cf.createBytecode("goto", -size));
						});
					}
					break;

				case "get_method":
					if (ins.name != "print") throw new Error();
					instructs.push(cf.createBytecode("getstatic", systemOut));
					stackPush("Object", "java.io.PrintStream");
					break;

				case "call":
					stackPop();
					stackPop();
					stackPop();
					if (ins.name != "print") throw new Error();
					// prettier-ignore
					switch (ins.args[0]) {
						case "string": instructs.push(cf.createBytecode("invokevirtual", printlnString)); break;
						case "int": instructs.push(cf.createBytecode("invokevirtual", printlnInt)); break;
						case "float": instructs.push(cf.createBytecode("invokevirtual", printlnFloat)); break;
						case "boolean": instructs.push(cf.createBytecode("invokevirtual", printlnBoolean)); break;
					}
					break;
				case "dup":
					stack.push(stack.at(-1));
					if (stack.length > maxStack) {
						maxStack = stack.length;
					}
					instructs.push(cf.createBytecode("dup"));
					break;
				case "swap":
					let a = stack.at(-1);
					let b = stack.at(-2);
					stack[stack.length - 1] = b;
					stack[stack.length - 2] = a;
					instructs.push(cf.createBytecode("swap"));
					break;
				case "add":
					stackPop();
					stackPop();
					// prettier-ignore
					switch (ins.type) {
						case "int": instructs.push(cf.createBytecode("iadd")); stackPush("Integer"); break;
						case "float": instructs.push(cf.createBytecode("fadd")); stackPush("Float"); break;
					}
					break;
				case "sub":
					stackPop();
					stackPop();
					// prettier-ignore
					switch (ins.type) {
						case "int": instructs.push(cf.createBytecode("isub")); stackPush("Integer"); break;
						case "float": instructs.push(cf.createBytecode("fsub")); stackPush("Float"); break;
					}
					break;
				case "div":
					stackPop();
					stackPop();
					// prettier-ignore
					switch (ins.type) {
						case "int": instructs.push(cf.createBytecode("idiv")); stackPush("Integer"); break;
						case "float": instructs.push(cf.createBytecode("fdiv")); stackPush("Float"); break;
					}
					break;
				case "mult":
					stackPop();
					stackPop();
					// prettier-ignore
					switch (ins.type) {
						case "int": instructs.push(cf.createBytecode("imul")); stackPush("Integer"); break;
						case "float": instructs.push(cf.createBytecode("fmul")); stackPush("Float"); break;
					}
					break;
				case "mod":
					stackPop();
					stackPop();
					instructs.push(cf.createBytecode("irem"));
					stackPush("Integer");
					break;
				case "expon":
					stackPop();
					stackPop();
					// TODO
					break;
				case "eq": {
					stackPop();
					stackPop();
					createStackMapFrame(i);
					stackPush("Integer");
					createStackMapFrame(i);
					if (ins.type == "string") {
						// TODO
					} else {
						let t;
						// prettier-ignore
						switch (ins.type) {
							case "int":   t = "i"; break;
							case "boolean": t = "i"; break;
							case "float": t = "f"; break;
							default: throw new Error();
						}
						instructs.push(
							cf.createBytecode(`if_${t}cmpne`, 7),
							cf.createBytecode("iconst_1"),
							cf.createBytecode("goto", 4),
							cf.createBytecode("iconst_0")
						);
					}
					break;
				}
				case "neq":
					stackPop();
					stackPop();
					createStackMapFrame(i);
					stackPush("Integer");
					createStackMapFrame(i);
					if (ins.type == "string") {
						// TODO
					} else {
						let t;
						// prettier-ignore
						switch (ins.type) {
							case "int":   t = "i"; break;
							case "boolean": t = "i"; break;
							case "float": t = "f"; break;
							default: throw new Error();
						}
						instructs.push(
							cf.createBytecode(`if_${t}cmpeq`, 7),
							cf.createBytecode("iconst_1"),
							cf.createBytecode("goto", 4),
							cf.createBytecode("iconst_0")
						);
					}
					break;
				case "gt":
					stackPop();
					stackPop();
					createStackMapFrame(i);
					stackPush("Integer");
					createStackMapFrame(i);
					if (ins.type == "string") {
						// TODO
					} else {
						let t;
						// prettier-ignore
						switch (ins.type) {
							case "int":   t = "i"; break;
							case "boolean": t = "i"; break;
							case "float": t = "f"; break;
							default: throw new Error();
						}
						instructs.push(
							cf.createBytecode(`if_${t}cmple`, 7),
							cf.createBytecode("iconst_1"),
							cf.createBytecode("goto", 4),
							cf.createBytecode("iconst_0")
						);
					}
					break;
				case "lt":
					stackPop();
					stackPop();
					createStackMapFrame(i);
					stackPush("Integer");
					createStackMapFrame(i);
					if (ins.type == "string") {
						// TODO
					} else {
						let t;
						// prettier-ignore
						switch (ins.type) {
							case "int":   t = "i"; break;
							case "boolean": t = "i"; break;
							case "float": t = "f"; break;
							default: throw new Error();
						}
						instructs.push(
							cf.createBytecode(`if_${t}cmpge`, 7),
							cf.createBytecode("iconst_1"),
							cf.createBytecode("goto", 4),
							cf.createBytecode("iconst_0")
						);
					}
					break;
				case "gt_eq":
					stackPop();
					stackPop();
					createStackMapFrame(i);
					stackPush("Integer");
					createStackMapFrame(i);
					if (ins.type == "string") {
						// TODO
					} else {
						let t;
						// prettier-ignore
						switch (ins.type) {
							case "int":   t = "i"; break;
							case "boolean": t = "i"; break;
							case "float": t = "f"; break;
							default: throw new Error();
						}
						instructs.push(
							cf.createBytecode(`if_${t}cmplt`, 7),
							cf.createBytecode("iconst_1"),
							cf.createBytecode("goto", 4),
							cf.createBytecode("iconst_0")
						);
					}
					break;
				case "lt_eq":
					stackPop();
					stackPop();
					createStackMapFrame(i);
					stackPush("Integer");
					createStackMapFrame(i);
					if (ins.type == "string") {
						// TODO
					} else {
						let t;
						// prettier-ignore
						switch (ins.type) {
							case "int":   t = "i"; break;
							case "boolean": t = "i"; break;
							case "float": t = "f"; break;
							default: throw new Error();
						}
						instructs.push(
							cf.createBytecode(`if_${t}cmpgt`, 7),
							cf.createBytecode("iconst_1"),
							cf.createBytecode("goto", 4),
							cf.createBytecode("iconst_0")
						);
					}
					break;
				case "and":
					stackPop();
					stackPop();
					stackPush("Integer");
					instructs.push(cf.createBytecode("iand"));
					break;
				case "or":
					stackPop();
					stackPop();
					stackPush("Integer");
					instructs.push(cf.createBytecode("ior"));
					break;
				case "xor":
					stackPop();
					stackPop();
					stackPush("Integer");
					instructs.push(cf.createBytecode("ixor"));
					break;
				case "left_shift":
					stackPop();
					stackPop();
					stackPush("Integer");
					instructs.push(cf.createBytecode("ishl"));
					break;
				case "right_shift":
					stackPop();
					stackPop();
					stackPush("Integer");
					instructs.push(cf.createBytecode("ishr"));
					break;
				case "unsigned_right_shift":
					stackPop();
					stackPop();
					stackPush("Integer");
					instructs.push(cf.createBytecode("iushr"));
					break;
				case "concat":
					stackPop();
					stackPop();
					stackPush("Object", "java.lang.String");
					instructs.push(
						cf.createBytecode("invokedynamic", StringConcat())
					);
				case "logical_and":
					stackPop();
					stackPop();
					stackPush("Integer");
					instructs.push(cf.createBytecode("iand"));
					break;
				case "logical_or":
					stackPop();
					stackPop();
					stackPush("Integer");
					instructs.push(cf.createBytecode("ior"));
					break;
				case "cast":
					stackPop();
					let from;
					switch (ins.from) {
						case "int":
							from = "i";
							break;
						case "float":
							from = "f";
							break;

						case "string":
						case "boolean":
						default:
							throw new Error();
					}

					let to;
					switch (ins.to) {
						case "int":
							to = "i";
							stackPush("Integer");
							break;
						case "float":
							to = "f";
							stackPush("Float");
							break;

						case "string":
						case "boolean":
						default:
							throw new Error();
					}

					instructs.push(cf.createBytecode(`${from}2${to}`));
					break;

				case "negate":
					stackPop();
					// prettier-ignore
					switch (ins.type) {
						case "int": instructs.push(cf.createBytecode("ineg")); stackPush("Integer"); break;
						case "float": instructs.push(cf.createBytecode("fneg")); stackPush("Float"); break;
					}
					break;

				default:
					throw new Error();
			}

			body.push(instructs);
		}
		body.push([cf.createBytecode("return")]);

		for (const item of queue) {
			item();
		}

		let bbody = [];
		for (const ele of body) {
			bbody.push(...ele);
		}

		cf.addMethod(
			AccessFlags.Method_Public | AccessFlags.Method_Static,
			"main",
			"void",
			["java.lang.String[]"],
			[
				cf.createCode(
					maxStack,
					maxLocals,
					bbody,
					stackmapframes.length > 0
						? [cf.createAttribute("StackMapTable", stackmapframes)]
						: []
				),
			]
		);

		return cf;
	}
}
const file = fs.readFileSync("./bnf/js.ebnf", "utf-8");
const file2 = fs.readFileSync(process.argv[2], "utf-8");

const bnf = new EBNF();
const parse = bnf.parse(file);
const intTokens = new EBNFTokenizer(parse);
const tokens = intTokens.run(file2);
const intAst = new EBNFAst(parse);
const ast = intAst.run(tokens);

const walker = new AstWalker(undefined);
const { code, variables } = walker.file(ast);

// const inter = new Interpreter();
// inter.run(code);

const classF = new ClassFileBuilder();
fs.writeFileSync(
	process.argv[3] + ".class",
	classF.run(process.argv[3], process.argv[2], code, variables).generate()
);
