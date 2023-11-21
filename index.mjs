import fs from "node:fs";

class ParseError extends Error {}

function c(str) {
	return str.charCodeAt(0);
}

function alpha(t) {
	return (
		(c(t) >= c("a") && c(t) <= c("z")) ||
		(c(t) >= c("A") && c(t) <= c("Z")) ||
		t == "_"
	);
}

function numeric(t) {
	return c(t) >= c("0") && c(t) <= c("9");
}

class EBNF {
	constructor() {}

	pop(n = 1) {
		if (n != 1) {
			while (--n) this.tokens.shift();
		}
		return this.tokens.shift();
	}

	seek(n = 1) {
		return this.tokens[n - 1];
	}

	collapseOrs(stuff) {
		let rules = [];
		let stack = [...stuff];
		let current = [];
		let name = "";
		let s = stack.pop();
		while (s) {
			switch (s.type) {
				case "string":
				case "id":
				case "class":
				case "set":
					current.unshift(s);
					break;

				case "group":
					current.unshift({
						type: "group",
						name: s.name,
						rules: this.collapseOrs(s.rules),
					});
					break;

				case "repeat":
					current.unshift({
						type: "repeat",
						min: s.min,
						max: s.max,
						rules: this.collapseOrs(s.rules),
					});
					break;

				case "tag":
					name = s.name;
					break;

				case "|":
					rules.push({ type: "rule", name, rules: current });
					current = [];
					name = "";
					break;

				default:
					throw new ParseError("huh");
			}
			s = stack.pop();
		}
		if (current.length != 0) {
			rules.push({ type: "rule", name, rules: current });
		}

		if (rules.length == 1) {
			return rules[0];
		}
		return { type: "or", rules: rules };
	}

	rule() {
		let stack = [];
		let t = this.pop();
		while (t.type != ";") {
			switch (t.type) {
				case "string":
				case "id":
				case "set":
				case "class":
					stack.push(t);
					break;
				case "|":
					stack.push(t);
					break;
				case "?":
					stack.push({
						type: "repeat",
						min: 0,
						max: 1,
						rules: [stack.pop()],
					});
					break;
				case "*":
					stack.push({
						type: "repeat",
						min: 0,
						rules: [stack.pop()],
					});
					break;
				case "+":
					stack.push({
						type: "repeat",
						min: 1,
						rules: [stack.pop()],
					});
					break;
				case "(": {
					let a = this.seek(1);
					let b = this.seek(2);
					if (a.type == "id" && b.type == ":") {
						stack.push({ type: "groupStart", name: a.value });
						this.pop(2);
					} else {
						stack.push({ type: "groupStart" });
					}
					break;
				}
				case "#": {
					let a = this.seek();
					if (a.type == "id") {
						this.pop();
						stack.push({ type: "tag", name: a.value });
						break;
					}
					throw new ParseError("huh");
				}
				case ")":
					let rules = [];
					let s = stack.pop();
					while (s.type != "groupStart") {
						rules.push(s);
						s = stack.pop();
					}
					stack.push({ type: "group", rules, name: s.name });
					break;
				default:
					throw new ParseError("huh");
			}
			t = this.pop();
		}

		return this.collapseOrs(stack);
	}

	optimizeRules(list) {
		// TODO : totally can be folded into #collapseOrs
		if (
			(list.name == "" || list.name == undefined) &&
			(list.type == "rule" || list.type == "group")
		) {
			list = list.rules;
		}
		if (!Array.isArray(list)) {
			list = [list];
		}

		let l = [];

		for (const t of list) {
			switch (t.type) {
				case "string":
				case "id":
				case "class":
				case "set":
					l.push(t);
					break;

				case "group":
				case "rule":
					if (t.name == "" || t.name == undefined) {
						if (t.rules.length == 1) {
							l.push(this.optimizeRules(t.rules[0]));
							break;
						}
						if (t.rules.type) {
							l.push(this.optimizeRules(t.rules));
							break;
						}
					}
					l.push({
						type: t.type,
						name: t.name,
						rules: this.optimizeRules(t.rules),
					});
					break;
				case "repeat":
					l.push({
						type: "repeat",
						min: t.min,
						max: t.max,
						rules: this.optimizeRules(t.rules),
					});
					break;
				case "or":
					if (t.rules.length == 1) {
						l.push(this.optimizeRules(t.rules[0]));
						break;
					}
					l.push({ type: "or", rules: this.optimizeRules(t.rules) });
					break;
				default:
					throw new ParseError("huh");
			}
		}

		if (l.length == 1) return l[0];
		return l;
	}

	parseBlock(skip = false) {
		let rules = [];
		let t = this.pop();
		while (t.type != "}") {
			let tt = this.pop();
			switch (t.type) {
				case "id":
					if ((tt.type = "=")) {
						rules.push({
							name: t.value,
							rules: this.rule(),
						});
						break;
					}
					if (skip && t.value == "skip" && tt.type == "->") {
						rules.push({
							name: "skip",
							rules: this.rule(),
						});
						break;
					}
					throw new ParseError("huh");
				default:
					throw new ParseError("huh");
			}
			t = this.pop();
		}
		for (const ele of rules) {
			ele.rules = this.optimizeRules(ele.rules);
		}

		return rules;
	}

	tokenize(file) {
		let tokens = [];

		let i = 0;
		while (i < file.length) {
			const t = file[i];

			switch (t) {
				case "\n":
				case "\t":
				case "\r":
				case " ":
					i++;
					continue;
				case "/":
					if (file[i + 1] == "/") {
						for (; ; i++) {
							if (file[i] == "\n") break;
						}
						continue;
					}
					throw new ParseError("what");
				case "(":
				case ")":
				case "{":
				case "}":
				case "+":
				case "*":
				case ".":
				case "|":
				case ";":
				case "=":
				case ":":
				case "#":
				case "?":
					tokens.push({ type: t });
					i++;
					continue;
				case "'":
				case '"': {
					let str = "";
					i++;
					for (; ; i++) {
						if (file[i] == t) break;
						if (file[i] == "\\") {
							str += file[i + 1];
							i++;
							continue;
						}
						str += file[i];
					}
					tokens.push({ type: "string", value: str });
					i++;
					continue;
				}
				case "[": {
					i++;
					let ranges = [];
					let not = false;
					if (file[i] == "^") {
						i++;
						not = true;
					}
					for (; ; i++) {
						if (file[i] == "]") break;

						if (file[i] == "\\") {
							ranges.push({
								type: "exact",
								value: c(file[i + 1]),
							});
							i++;
							continue;
						}
						if (file[i + 1] == "-") {
							ranges.push({
								type: "range",
								min: c(file[i]),
								max: c(file[i + 2]),
							});
							i += 2;
							continue;
						}
						ranges.push({
							type: "exact",
							value: c(file[i]),
						});
					}
					i++;
					tokens.push({ type: "set", invert: not, ranges });
					continue;
				}
				case "-":
					if (file[i + 1] == ">") {
						tokens.push({ type: "->" });
						i += 2;
						continue;
					}
					throw new ParseError("what");
				case "\\":
					tokens.push({ type: "class", value: file[i + 1] });
					i += 2;
					continue;
				default:
					if (alpha(t)) {
						let id = "";
						for (; ; i++) {
							if (!alpha(file[i]) && !numeric(file[i])) break;
							id += file[i];
						}
						tokens.push({ type: "id", value: id });
						continue;
					}
					throw new ParseError("what");
			}
		}

		return tokens;
	}

	parse(str) {
		this.tokens = this.tokenize(str);

		if (this.pop().value != "tokens" || this.pop().type != "{")
			throw new ParseError("huh");

		let tokenizerRules = this.parseBlock(true);

		if (this.pop().value != "ast" || this.pop().type != "{")
			throw new ParseError("huh");

		let astRules = this.parseBlock(false);

		return { tokens: tokenizerRules, ast: astRules };
	}
}

const file = fs.readFileSync("./js.ebnf", "utf-8");

let ast = new EBNF();
let parse = ast.parse(file);
console.log(JSON.stringify(parse));
