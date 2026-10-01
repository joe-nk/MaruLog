import type { Expr } from "./parser";

export type Value = number | boolean;

export type EvalContext = {
	data: Value[];
};

const DATA_SIZE = 256;
const MAX_LOOP = 10_000;
const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

export function createData(): Value[] {
	return Array<Value>(DATA_SIZE).fill(0);
}

export class EvalError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "EvalError";
	}
}

function number(value: Value): number {
	if (
		typeof value !== "number" ||
		!Number.isSafeInteger(value) ||
		value < INT32_MIN ||
		value > INT32_MAX
	) {
		throw new EvalError("Number expected");
	}
	return value;
}

function int32(value: number): number {
	if (!Number.isSafeInteger(value)) {
		throw new EvalError("integer result is not finite");
	}
	return value | 0;
}

function bool(value: Value): boolean {
	if (typeof value !== "boolean") {
		throw new EvalError("Bool expected");
	}
	return value;
}

function index(value: Value): number {
	const n = number(value);
	if (!Number.isInteger(n) || n < 0 || n >= DATA_SIZE) {
		throw new EvalError(`invalid data index: ${n}`);
	}
	return n;
}

function args(
	items: Expr[],
	count: number,
	op: string,
): Expr[] {
	if (items.length !== count + 1) {
		throw new EvalError(
			`${op}: expected ${count} arguments, got ${items.length - 1}`,
		);
	}
	return items.slice(1);
}

export function evaluate(
	expr: Expr,
	ctx: EvalContext,
): Value {
	switch (expr.type) {
		case "number":
			return number(expr.value);
		case "bool":
			return expr.value;
		case "symbol":
			throw new EvalError(
				`unexpected symbol: ${expr.name}`,
			);
		case "list":
			return evaluateList(expr.items, ctx);
	}
}

function evaluateList(
	items: Expr[],
	ctx: EvalContext,
): Value {
	if (items.length === 0) {
		throw new EvalError("empty expression");
	}
	const head = items[0];
	// eval.txt allows a list of expressions to be used as a sequence.
	// The last expression's value is the value of the sequence.
	if (head.type === "list") {
		let result: Value = false;
		for (const item of items) {
			result = evaluate(item, ctx);
		}
		return result;
	}
	if (head.type !== "symbol") {
		throw new EvalError(
			"operator must be a symbol",
		);
	}
	const op = head.name;
	switch (op) {

		case "?": {
			const [condition, yes, no] =
				args(items, 3, "?");
			if (bool(evaluate(condition, ctx))) {
				return evaluate(yes, ctx);
			}
			return evaluate(no, ctx);
		}

		case "!": {
			const [condition, body] =
				args(items, 2, "!");
			for (
				let i = 0;
				i < MAX_LOOP;
				i++
			) {
				if (!bool(evaluate(condition, ctx))) {
					return true;
        }
				evaluate(body, ctx);
			}
			return false;
		}

		case "+": {
			const [a, b] = args(items, 2, "+");
			return int32(
				number(evaluate(a, ctx)) +
				number(evaluate(b, ctx))
			);
		}

		case "-": {
			const [a, b] = args(items, 2, "-");
			return int32(
				number(evaluate(a, ctx)) -
				number(evaluate(b, ctx))
			);
		}

		case "*": {
			const [a, b] = args(items, 2, "*");
			return Math.imul(
				number(evaluate(a, ctx)),
				number(evaluate(b, ctx)),
			);
		}

		case "/": {
			const [a, b] = args(items, 2, "/");
			const dividend = number(evaluate(a, ctx));
			const divisor = number(evaluate(b, ctx));
			if (divisor === 0){
				throw new EvalError("Zero divide");
			}
			return int32(Math.trunc(dividend / divisor));
		}

		case "%": {
			const [a, b] = args(items, 2, "%");
			const dividend = number(evaluate(a, ctx));
			const divisor = number(evaluate(b, ctx));
			if (divisor === 0){
				throw new EvalError("Zero divide");
			}
			return int32(dividend % divisor);
		}

    case "&": {
			const [a, b] = args(items, 2, "&");
			return (
				number(evaluate(a, ctx)) &
				number(evaluate(b, ctx))
			);
		}

    case "|": {
			const [a, b] = args(items, 2, "|");
			return (
				number(evaluate(a, ctx)) |
				number(evaluate(b, ctx))
			);
		}

    case "~": {
			const [a] = args(items, 1, "~");
			return ~number(evaluate(a, ctx));
		}

    case "^": {
			const [a, b] = args(items, 2, "^");
			return (
				number(evaluate(a, ctx)) ^
				number(evaluate(b, ctx))
			);
		}

		case "<": {
			const [a, b] = args(items, 2, "<");
			return (
				number(evaluate(a, ctx)) <
				number(evaluate(b, ctx))
			);
		}

		case "=": {
			const [a, b] = args(items, 2, "=");
			return (
				evaluate(a, ctx) ===
				evaluate(b, ctx)
			);
		}

		case "&&": {
			const [a, b] = args(items, 2, "&&");
			const av = bool(evaluate(a, ctx));
			const bv = bool(evaluate(b, ctx));
			return av && bv;
		}

		case "||": {
			const [a, b] = args(items, 2, "||");
			const av = bool(evaluate(a, ctx));
			const bv = bool(evaluate(b, ctx));
			return av || bv;
		}

		case "~~": {
			const [a] = args(items, 1, "~~");
			return !bool(evaluate(a, ctx));
		}

		case "@": {
			const [a] = args(items, 1, "@");
			const value = ctx.data[index(evaluate(a, ctx))];
			return typeof value === "number" ? number(value) : value;
		}

		case "#": {
			const [a, b] = args(items, 2, "#");
			const i = index(evaluate(a, ctx));
			const value = evaluate(b, ctx);
			if (typeof value === "number") {
				number(value);
			}
			ctx.data[i] = value;
			return value;
		}

		default:
			throw new EvalError(
				`unknown operator: ${op}`,
			);
	}
}
