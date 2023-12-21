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

function toArray(t = []) {
	if (!Array.isArray(t)) {
		return [t];
	}
	return t;
}

function toSet(s = new Set()) {
	if (s instanceof Set) {
		return s;
	}
	return new Set(toArray(s));
}

const classes = {
	d: {
		type: "set",
		invert: false,
		ranges: [{ type: "range", min: c("0"), max: c("9") }],
	},
	D: {
		type: "set",
		invert: true,
		ranges: [{ type: "range", min: c("0"), max: c("9") }],
	},
	w: {
		type: "set",
		invert: false,
		ranges: [
			{ type: "range", min: c("A"), max: c("Z") },
			{ type: "range", min: c("a"), max: c("z") },
			{ type: "range", min: c("0"), max: c("9") },
			{ type: "exact", value: c("_") },
		],
	},
	W: {
		type: "set",
		invert: true,
		ranges: [
			{ type: "range", min: c("A"), max: c("Z") },
			{ type: "range", min: c("a"), max: c("z") },
			{ type: "range", min: c("0"), max: c("9") },
			{ type: "exact", value: c("_") },
		],
	},
	s: {
		// \u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff
		type: "set",
		invert: false,
		ranges: [
			{ type: "exact", value: c("\f") },
			{ type: "exact", value: c("\n") },
			{ type: "exact", value: c("\r") },
			{ type: "exact", value: c("\t") },
			{ type: "exact", value: c("\v") },
			{ type: "exact", value: c(" ") },
		],
	},
	S: {
		// \u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff
		type: "set",
		invert: true,
		ranges: [
			{ type: "exact", value: c("\f") },
			{ type: "exact", value: c("\n") },
			{ type: "exact", value: c("\r") },
			{ type: "exact", value: c("\t") },
			{ type: "exact", value: c("\v") },
			{ type: "exact", value: c(" ") },
		],
	},
};

class EBNF {
	constructor() {}

	pop() {
		return this.tokens.shift();
	}

	seek(n = 1) {
		return this.tokens[n - 1];
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
				case ".":
					tokens.push({ type: "any" });
					i++;
					continue;
				case "'":
				case '"': {
					let str = "";
					i++;
					for (; ; i++) {
						if (file[i] == t) break;
						if (file[i] == "\\") {
							let f = file[i + 1];
							switch (f) {
								case "n":
									str += "\n";
									break;
								case "r":
									str += "\r";
									break;
								case "t":
									str += "\t";
									break;
								default:
									str += f;
									break;
							}
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
							let f = file[i + 1];
							let v = 0;
							switch (f) {
								case "n":
									v = c("\n");
									break;
								case "r":
									v = c("\r");
									break;
								case "t":
									v = c("\t");
									break;
								default:
									v = c(f);
									break;
							}

							ranges.push({
								type: "exact",
								value: v,
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
					let v = file[i + 1];
					if (classes[v] == undefined) {
						throw new ParseError("what");
					}
					tokens.push(classes[v]);
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

	rule() {
		let stack = [];
		let t = this.pop();
		while (t.type != ";") {
			switch (t.type) {
				case "string":
				case "id":
				case "set":
				case "class":
				case "any":
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
						this.pop();
						this.pop();
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
				case "any":
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
		return { type: "or", rules: rules.reverse() };
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
				case "any":
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

class EBNFTokenizer {
	constructor(ast) {
		this.bnf = ast;
		this.lock = false;
	}

	rule(rule, index, str) {
		let end = -1;
		let i = 0;

		if (str[index] == undefined) return -1;

		switch (rule.type) {
			case "string":
				for (i = 0; i < rule.value.length; i++) {
					if (str[i + index] != rule.value[i]) {
						end = -1;
						break;
					}
					end = index + i;
				}
				break;

			case "or":
				for (const r of rule.rules) {
					let v = this.rule(r, index, str);
					if (v != -1) {
						end = v;
						break;
					}
				}
				break;

			case "repeat":
				end = index;
				while (i <= (rule.max ?? Infinity)) {
					let v = this.rule(rule.rules, end, str);
					if (v == -1) break;
					end = v + 1;
					i++;
				}
				end--;
				if (i < rule.min) {
					end = -1;
				}
				break;

			case "set": {
				let code = c(str[index]);
				let match = false;
				for (const r of rule.ranges) {
					if (r.type == "exact" && r.value == code) {
						match = true;
					}
					if (r.type == "range" && code >= r.min && code <= r.max) {
						match = true;
					}
				}
				end = rule.invert ^ match ? index : -1;
				break;
			}

			case "any":
				end = index;
				break;

			case "rule":
			default:
				let rr;
				if (rule.rules != undefined) {
					rr = rule.rules;
				} else {
					rr = rule;
				}

				if (Array.isArray(rr)) {
					end = index;
					for (const r of rr) {
						let v = this.rule(r, end, str);
						if (v == -1) return -1;
						end = v + 1;
					}
					end--;
				} else {
					end = this.rule(rr, index, str);
				}
				break;
		}

		return end;
	}

	run(str) {
		if (this.lock) throw new ParseError("stop it");
		this.lock = true;
		let tokens = [];
		top: for (let i = 0; i < str.length; ) {
			for (const rule of this.bnf.tokens) {
				let end = this.rule(rule, i, str);
				if (end == -1) continue;
				if (rule.name != "skip") {
					tokens.push({
						type: rule.name,
						value: str.slice(i, end + 1),
					});
				}
				i = end + 1;
				continue top;
			}
			throw new ParseError("hmm?");
		}

		this.lock = false;

		return tokens;
	}
}

class EBNFAst {
	constructor(ast) {
		this.bnf = ast;
		this.lock = false;

		let astRules = {};

		for (const rule of this.bnf.ast) {
			astRules[rule.name] = toArray(rule.rules);
		}

		this.astRules = astRules;
	}

	lastParsed = undefined;
	referenceStack = [];
	tokenIndex = 0;

	astRule(kind, tokens, list) {
		let rules = toArray(list ?? this.astRules[kind]);
		let final = { kind };

		top: for (let i = 0; i < rules.length; ) {
			if (i == -1) return;
			if (tokens.length - this.tokenIndex <= 0) return;
			const r = rules[i];
			switch (r.type) {
				case "string":
					if (tokens[this.tokenIndex].value == r.value) {
						this.tokenIndex++;
						i++;
						continue;
					}
					i--;
					continue;

				case "rule": {
					let res = this.astRule(r.name, tokens, r.rules);
					if (res) {
						return res;
					}
					return;
				}

				case "id":
					if (
						this.lastParsed &&
						this.lastParsed.type.has(this.referenceStack[0]) &&
						rules.length > 1
					) {
						// rules.length > 1 because if:
						// expr = value | expr + value;
						// value = number; 
						// (or other such instances)
						// then we'd enter an endless loop no matter what, bc if its by itself 
						// there, by definition, can't be more tokens to consume

						if (this.lastParsed.type.has(r.value)) {
							let lp = this.lastParsed;
							this.lastParsed = undefined;
							return lp;
						}
						return;
					}

					if (this.astRules[r.value]) {
						this.referenceStack.unshift(r.value);
						let res = this.astRule(r.value, tokens);
						let type = this.referenceStack[0];
						this.referenceStack.shift();
						if (res) {
							res.type = toSet(res.type);
							res.type.add(type);
							this.lastParsed = res;
							return res;
						}
						i--;
						continue;
					}

					if (tokens[this.tokenIndex].type == r.value) {
						return tokens[this.tokenIndex++].value;
					}

					i--;
					continue;

				case "group": {
					const rr = toArray(r.rules)[0];
					if (rr.type == "id") {
						if (
							this.lastParsed &&
							this.lastParsed.type.has(this.referenceStack[0]) 

						) {
							if (this.lastParsed.type.has(rr.value)) {
								final[r.name] = this.lastParsed;
								this.lastParsed = undefined;
								i++;
								continue;
							}
							i--;
							continue;
						}

						
						if (this.astRules[rr.value]) {
							if (!this.lastParsed && rr.value == this.referenceStack[0] && this.referenceStack[0] == this.referenceStack[1]) {
								// prevent endless loop, we shouldn't really have nested ids
								return;
							}

							this.referenceStack.unshift(rr.value);
							let res = this.astRule(rr.value, tokens);
							let type = this.referenceStack[0];
							this.referenceStack.shift();
							if (res) {
								res.type = toSet(res.type);
								res.type.add(type);
								final[r.name] = res;
								this.lastParsed = res;
								i++;
								continue;
							}
							return;
						}
						
						
						if (tokens[this.tokenIndex].type == rr.value) {
							final[r.name] = tokens[this.tokenIndex++].value;
							i++;
							continue;
						}

						i--;
						continue;
					}

					if (rr.type == "string") {
						if (tokens[this.tokenIndex].value == rr.value) {
							final[r.name] = tokens[this.tokenIndex++].value;
							i++;
							continue;
						}
						i--;
						continue;
					}

					if (rr.type == "repeat") {
						let arr = [];
						while (true) {
							this.lastParsed = undefined; 
							// clear lastParsed before iteration, bc it *shouldn't* be necessary
							// for instance, think about what happens between statements, well you 
							// can't exactly go back to the previous one because how this is structured
							// so in all honesty lastParsed can't be here, cuz it causes bugs
							let res = this.astRule(kind, tokens, [rr.rules]);
							if (!res) break;
							arr.push(res);
						}
						if (arr.length != 0) {
							final[r.name] = arr;
							i++;
							continue;
						}
						return;
					}

					if (rr.type == "or") {
						for (const rrr of rr.rules) {
							let ti = this.tokenIndex;
							let lp = this.lastParsed; // shallow copy should be okay
							let res = this.astRule(kind, tokens, {
								type: "group",
								rules: rrr,
								name: r.name,
							});
							if (res) {
								final[r.name] = res[r.name];
								i++;
								continue top;
							}
							this.tokenIndex = ti;
							this.lastParsed = lp;
						}

						return;
					}

					throw new ParseError("whodunnit");
				}

				case "or": {
					for (const rr of r.rules) {
						let ti = this.tokenIndex;
						let lp = this.lastParsed; // shallow copy should be okay
						let res = this.astRule(kind, tokens, rr);
						if (res) {
							return res;
						}
						this.tokenIndex = ti;
						this.lastParsed = lp;
					}

					return;
				}

				default:
					throw new ParseError("whodunnit");
			}
		}

		if (kind == "file" && tokens.length - this.tokenIndex > 0) {
			throw new ParseError("whodunnit");
		}

		return final;
	}

	astRules = {};

	ruleOld(inital, tokens) {
		let rules = [
			{
				type: "rules",
				name: inital,
				rules: this.astRules[inital],
				slots: [],
			},
		];
		let tokenIndex = 0;

		while (rules.length > 0) {
			let rule = rules[0];
			let data = toArray(rule.rules);
			let failed = false;

			top: for (let i = 0; i < data.length; i++) {
				const ele = data[i];

				switch (ele.type) {
					case "group": {
						const id = ele.name;
						for (const slot of rule.slots) {
							if (slot.name == id) {
								if (!slot.completed) {
									failed = true;
									break top;
								}
								continue top;
							}
						}
						rule.slots.unshift({
							type: "group",
							name: id,
							completed: false,
							value: undefined,
						});
						rules.unshift({
							type: "group",
							name: id,
							rules: ele.rules,
							slots: [],
						});
						break top;
					}

					case "rule": {
						let name = ele.name || i;

						for (const slot of rule.slots) {
							if (slot.type == "rule" && slot.name == name) {
								if (!slot.completed) {
									failed = true;
									break top;
								}
								continue top;
							}
						}
						rule.slots.unshift({
							type: "rule",
							name: name,
							completed: false,
							value: undefined,
						});
						rules.unshift({
							type: "rule",
							name: name,
							rules: ele.rules,
							slots: [],
						});
						break top;
					}

					case "repeat": {
						if (rule.slots.length > 0) {
							if (!rule.slots.at(-1).completed) {
								continue top;
							}
						}
						const slot = {
							type: "repeat",
							completed: false,
							value: undefined,
						};
						let index = rule.slots.push(slot) - 1;
						slot.name = index;
						rules.unshift({
							type: "repeat",
							name: index,
							rules: ele.rules,
							slots: [],
						});
						break top;
					}

					case "string": {
						const id = i;
						for (const slot of rule.slots) {
							if (slot.name == id && slot.type == "string") {
								continue top;
							}
						}
						if (tokenIndex < tokens.length) {
							const t = tokens[tokenIndex++];
							if (t.value == ele.value) {
								rule.slots.unshift({
									type: "string",
									name: id,
									completed: true,
									value: t.value,
								});
								continue top;
							}
						}
						failed = true;
						break top;
					}

					case "id": {
						const id = i;
						for (const slot of rule.slots) {
							if (slot.name == id && slot.type == "id") {
								if (!slot.completed) {
									failed = true;
									break top;
								}
								continue top;
							}
						}

						if (this.astRules[ele.value]) {
							rule.slots.unshift({
								type: "id",
								name: id,
								completed: false,
								value: undefined,
							});
							rules.unshift({
								type: "id",
								name: id,
								rules: this.astRules[ele.value],
								slots: [],
							});
							break top;
						}

						if (tokenIndex < tokens.length) {
							const t = tokens[tokenIndex++];
							if (t.type == ele.value) {
								rule.slots.unshift({
									type: "id",
									name: id,
									completed: true,
									value: t.value,
								});
								continue top;
							}
						}

						failed = true;
						break top;
					}

					case "or":
						const id = i;

						for (const slot of rule.slots) {
							if (slot.name == id && slot.type == "or") {
								if (slot.completed) {
									continue top;
								}
								slot.index = slot.index + 1;
								if (slot.index >= ele.rules.length) {
									failed = true;
									break top;
								}
								tokenIndex = slot.tokenIndex;
								rules.unshift({
									type: "or",
									name: id,
									rules: ele.rules[slot.index],
									slots: [],
								});
								break top;
							}
						}

						rule.slots.unshift({
							type: "or",
							name: id,
							completed: false,
							index: 0,
							tokenIndex,
						});
						rules.unshift({
							type: "or",
							name: id,
							rules: ele.rules[0],
							slots: [],
						});
						break top;

					default:
						throw new ParseError("whodunnit");
				}
			}

			if (rules[0] == rule) {
				if (rules.length == 1) return rules[0];

				if (!failed) {
					let parent = rules[1];

					for (const slot of parent.slots) {
						if (slot.name == rule.name && slot.type == rule.type) {
							slot.completed = true;
							slot.value = rule;
						}
					}
				}

				rules.shift();
			}
		}

		throw new ParseError("whodunnit");
	}

	compressSlot(node) {
		if (node.type == "or" || node.type == "rule" || node.type == "group") {
			return this.compress(node.value);
		}

		if (node.type == "id" || node.type == "string") {
			if (typeof node.value == "object") {
				return this.compress(node.value);
			}
			return node.value;
		}

		if (node.type == "repeat") {
			if (node.value) return this.compress(node.value);
			return;
		}

		return {
			type: node.type,
			name: node.name,
			value:
				typeof node.value == "object"
					? this.compress(node.value)
					: node.value,
		};
	}

	compress(node) {
		if (node.type == "or" || node.type == "repeat") {
			return this.compressSlot(node.slots[0]);
		}

		if (node.type == "rules" || node.type == "group") {
			let obj = { name: node.name, type: "group" };
			let arr = node.slots.map((v) => this.compressSlot(v));
			obj.children = arr.length == 1 ? arr[0] : arr;
			return obj;
		}

		if (node.type == "id") {
			let arr = node.slots.map((v) => this.compressSlot(v));

			if (arr.length == 1) return arr[0];
			return arr;
		}

		if (node.type == "rule") {
			let obj = { name: node.name };

			return node.slots.map((v) => this.compressSlot(v));
		}
	}

	run(tokens) {
		if (this.lock) throw new ParseError("stop it");
		this.lock = true;

		let ast = this.astRule("file", [...tokens]);
		ast.type = "file";

		// let ast = this.compress(this.ruleOld("file", tokens));

		this.lock = false;

		return ast;
	}
}

const file = fs.readFileSync("./js.ebnf", "utf-8");
const file2 = fs.readFileSync("./tests/full.js", "utf-8");

function json(s) {
	return JSON.stringify(s, (k, v) => (v instanceof Set ? [...v] : v), 4)
}

let ast = new EBNF();
let parse = ast.parse(file);
fs.writeFileSync("./build/bnf.json", json(parse));

let intTokens = new EBNFTokenizer(parse);
let tokens = intTokens.run(file2);
fs.writeFileSync("./build/tokens.json", json(tokens));

let intAst = new EBNFAst(parse);
fs.writeFileSync("./build/ast.json", json(intAst.run(tokens)));
