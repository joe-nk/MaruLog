export type Expr =
	| NumberLiteral
	| BoolLiteral
	| SymbolExpr
	| ListExpr;

export interface NumberLiteral {
	type: "number";
	value: number;
}

const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

export interface BoolLiteral {
	type: "bool";
	value: boolean;
}

export interface SymbolExpr {
	type: "symbol";
	name: string;
}

export interface ListExpr {
	type: "list";
	items: Expr[];
}

type Token =
	| { type: "lparen" }
	| { type: "rparen" }
	| { type: "number"; value: number }
	| { type: "symbol"; value: string }
	| { type: "boolean"; value: boolean };

export class ParseError extends Error {
	constructor(
		message: string,
		public readonly position: number,
	) {
		super(`${message} at position ${position}`);
	}
}

function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	while (i < source.length) {
		const c = source[i];
		if (/\s/.test(c)) {
			i++;
			continue;
		}

		if (c === "(") {
			tokens.push({ type: "lparen" });
			i++;
			continue;
		}

		if (c === ")") {
			tokens.push({ type: "rparen" });
			i++;
			continue;
		}

		if (
			/[0-9]/.test(c) ||
			(c === "-" && /[0-9]/.test(source[i + 1] ?? ""))
		) {
			const start = i;
			if (c === "-") {
				i++;
			}
			while (/[0-9]/.test(source[i] ?? "")) {
				i++;
			}
			if (source[i] === ".") {
				throw new ParseError(
					"expected a 32-bit signed integer",
					i,
				);
			}

			const text = source.slice(start, i);
			const value = Number(text);
			if (
				!Number.isSafeInteger(value) ||
				value < INT32_MIN ||
				value > INT32_MAX
			) {
				throw new ParseError(
					`integer out of 32-bit signed range: ${text}`,
					start,
				);
			}
			tokens.push({
				type: "number",
				value,
			});
			continue;
		}

		{
			const start = i;
			while (
				i < source.length &&
				!/\s/.test(source[i]) &&
				source[i] !== "(" &&
				source[i] !== ")"
			) {
				i++;
			}
			const value = source.slice(start, i);
			if (value === "true") {
				tokens.push({
					type: "boolean",
					value: true,
				});
			} else if (value === "false") {
				tokens.push({
					type: "boolean",
					value: false,
				});
			} else {
				tokens.push({
					type: "symbol",
					value,
				});
			}
		}
	}
	return tokens;
}

export class Parser {
	private readonly tokens: Token[];
	private position = 0;

	constructor(source: string) {
		this.tokens = tokenize(source);
	}

	parse(): Expr {
		const expr = this.parseExpr();
		if (this.position !== this.tokens.length) {
			throw new ParseError(
				"unexpected token after expression",
				this.position,
			);
		}
		return expr;
	}

	private parseExpr(): Expr {
		const token = this.peek();
		if (!token) {
			throw new ParseError(
				"unexpected end of input",
				this.position,
			);
		}
		switch (token.type) {
			case "number":
				this.position++;
				return {
					type: "number",
					value: token.value,
				};
			case "boolean":
				this.position++;
				return {
					type: "bool",
					value: token.value,
				};
			case "symbol":
				this.position++;
				return {
					type: "symbol",
					name: token.value,
				};
			case "lparen":
				return this.parseList();
			case "rparen":
				throw new ParseError(
					"unexpected ')'",
					this.position,
				);
		}
	}

	private parseList(): ListExpr {
		this.expect("lparen");
		const items: Expr[] = [];
		while (true) {
			const token = this.peek();
			if (!token) {
				throw new ParseError(
					"expected ')', reached end of input",
					this.position,
				);
			}
			if (token.type === "rparen") {
				this.position++;
				break;
			}
			items.push(this.parseExpr());
		}
		return {
			type: "list",
			items,
		};
	}

	private peek(): Token | undefined {
		return this.tokens[this.position];
	}
	private expect(type: Token["type"]): Token {
		const token = this.peek();
		if (!token || token.type !== type) {
			throw new ParseError(
				`expected ${type}`,
				this.position,
			);
		}
		this.position++;
		return token;
	}
}

export function parse(source: string): Expr {
	return new Parser(source).parse();
}
