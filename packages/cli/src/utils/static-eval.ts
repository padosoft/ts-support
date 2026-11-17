import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
	type Argument,
	type Expression,
	type Program,
	parseSync,
	Visitor,
} from "oxc-parser";

export type Json =
	| string
	| number
	| boolean
	| null
	| Json[]
	| { [key: string]: Json };

/** Key of the marker object that stands in for a value that cannot be evaluated statically. */
export const OPAQUE_KEY = "$expr";

export const isJsonObject = (value: Json): value is { [key: string]: Json } =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export interface ParsedFile {
	file: string;
	text: string;
	program: Program;
}

/** A construct the static evaluator does not understand. */
export class StaticEvalError extends Error {}

const SOURCE_EXTENSION = /\.tsx?$/;

type Wrapped = Expression | Argument;

/** Strips `as`, `satisfies`, `<T>x`, `x!` and parentheses. */
function unwrap(node: Wrapped): Wrapped {
	let current = node;
	while (
		current.type === "TSAsExpression" ||
		current.type === "TSSatisfiesExpression" ||
		current.type === "TSTypeAssertion" ||
		current.type === "TSNonNullExpression" ||
		current.type === "ParenthesizedExpression"
	) {
		current = current.expression;
	}
	return current;
}

/**
 * Evaluates TypeScript expressions into plain JSON, without a type checker:
 * literals, objects/arrays, spreads, arithmetic, `const`s of the same file or
 * of a relative import, and member access on those. Anything else throws
 * {@link StaticEvalError}, so a contract can never silently have holes.
 */
export class StaticProject {
	private readonly cache = new Map<string, ParsedFile>();
	private readonly opaqueRoots: readonly string[];

	/**
	 * @param opaqueRoots expressions (calls or member accesses) rooted at one of
	 *   these names are not evaluated: they become `{ $expr: "<source>" }`.
	 */
	constructor(opaqueRoots: readonly string[] = []) {
		this.opaqueRoots = opaqueRoots;
	}

	parse(file: string): ParsedFile {
		const cached = this.cache.get(file);
		if (cached) return cached;
		const text = readFileSync(file, "utf8");
		const result = parseSync(file, text, { preserveParens: false });
		const [first] = result.errors;
		if (first) throw new StaticEvalError(`${file}: ${first.message}`);
		const parsed = { file, text, program: result.program };
		this.cache.set(file, parsed);
		return parsed;
	}

	/** Error located at `node`; `throw` it so TypeScript narrows control flow. */
	error(
		pf: ParsedFile,
		node: { start: number },
		message: string,
	): StaticEvalError {
		return new StaticEvalError(
			`${pf.file}:${this.lineOf(pf, node)}: ${message}`,
		);
	}

	fail(pf: ParsedFile, node: { start: number }, message: string): never {
		throw this.error(pf, node, message);
	}

	lineOf(pf: ParsedFile, node: { start: number }): number {
		return pf.text.slice(0, node.start).split("\n").length;
	}

	source(pf: ParsedFile, node: { start: number; end: number }): string {
		return pf.text.slice(node.start, node.end);
	}

	private isOpaque(pf: ParsedFile, node: Expression): boolean {
		const head =
			node.type === "CallExpression"
				? this.source(pf, node.callee)
				: node.type === "MemberExpression"
					? this.source(pf, node)
					: undefined;
		return (
			head !== undefined &&
			this.opaqueRoots.some(
				(root) => head === root || head.startsWith(`${root}.`),
			)
		);
	}

	evaluate(pf: ParsedFile, node: Wrapped): Json {
		const expr = unwrap(node);
		if (expr.type === "Literal") {
			const { value } = expr;
			if (typeof value === "string" || typeof value === "number") return value;
			if (typeof value === "boolean") return value;
			if (value === null && !("regex" in expr) && !("bigint" in expr)) {
				return null;
			}
			return this.fail(
				pf,
				expr,
				`unsupported literal: ${this.source(pf, expr)}`,
			);
		}
		if (expr.type === "TemplateLiteral" && expr.expressions.length === 0) {
			return expr.quasis[0]?.value.cooked ?? "";
		}
		if (expr.type === "UnaryExpression" && expr.operator === "-") {
			const operand = this.evaluate(pf, expr.argument);
			if (typeof operand === "number") return -operand;
		}
		if (
			expr.type === "BinaryExpression" &&
			expr.left.type !== "PrivateIdentifier"
		) {
			const left = this.evaluate(pf, expr.left);
			const right = this.evaluate(pf, expr.right);
			if (typeof left === "number" && typeof right === "number") {
				switch (expr.operator) {
					case "+":
						return left + right;
					case "-":
						return left - right;
					case "*":
						return left * right;
					case "/":
						return left / right;
				}
			}
			return this.fail(
				pf,
				expr,
				`unsupported binary expression: ${this.source(pf, expr)}`,
			);
		}
		if (
			(expr.type === "CallExpression" || expr.type === "MemberExpression") &&
			this.isOpaque(pf, expr)
		) {
			return {
				[OPAQUE_KEY]:
					expr.type === "CallExpression"
						? this.source(pf, expr.callee)
						: this.source(pf, expr),
			};
		}
		if (expr.type === "ArrayExpression") {
			return expr.elements.map((element) => {
				if (element === null || element.type === "SpreadElement") {
					return this.fail(
						pf,
						expr,
						"holes and spreads in arrays are not supported",
					);
				}
				return this.evaluate(pf, element);
			});
		}
		if (expr.type === "ObjectExpression") return this.evaluateObject(pf, expr);
		if (expr.type === "Identifier") {
			if (expr.name === "undefined") return null;
			const found = this.findConst(pf, expr.name);
			if (!found) {
				return this.fail(
					pf,
					expr,
					`constant "${expr.name}" cannot be resolved`,
				);
			}
			return this.evaluate(found.pf, found.init);
		}
		if (expr.type === "MemberExpression") {
			const target = this.evaluate(pf, expr.object);
			const key = this.memberKey(pf, expr);
			if (isJsonObject(target) && target[key] !== undefined) return target[key];
			if (Array.isArray(target) && target[Number(key)] !== undefined) {
				return target[Number(key)] as Json;
			}
			return this.fail(
				pf,
				expr,
				`member access "${this.source(pf, expr)}" cannot be resolved`,
			);
		}
		return this.fail(
			pf,
			expr,
			`unsupported expression: ${this.source(pf, expr).slice(0, 60)}`,
		);
	}

	private memberKey(
		pf: ParsedFile,
		expr: Extract<Expression, { type: "MemberExpression" }>,
	): string {
		const { property } = expr;
		if (!expr.computed && property.type === "Identifier") return property.name;
		if (property.type === "Literal" && property.value !== null) {
			return String(property.value);
		}
		return this.fail(pf, expr, "computed member access is not supported");
	}

	private evaluateObject(
		pf: ParsedFile,
		expr: Extract<Expression, { type: "ObjectExpression" }>,
	): Json {
		const out: Record<string, Json> = {};
		for (const prop of expr.properties) {
			if (prop.type === "SpreadElement") {
				const spread = this.evaluate(pf, prop.argument);
				if (!isJsonObject(spread)) {
					this.fail(pf, prop, "spread of a non-object value");
				}
				Object.assign(out, spread);
				continue;
			}
			if (prop.kind !== "init" || prop.method || prop.computed) {
				this.fail(
					pf,
					prop,
					"computed keys, methods and accessors are not supported",
				);
			}
			const { key } = prop;
			const name =
				key.type === "Identifier"
					? key.name
					: key.type === "Literal"
						? String(key.value)
						: this.fail(pf, key, "unsupported property key");
			out[name] = this.evaluate(pf, prop.value);
		}
		return out;
	}

	/** Top-level `const <name> = …` of the file, or of the relative file importing it. */
	findConst(
		pf: ParsedFile,
		name: string,
	): { pf: ParsedFile; init: Expression } | undefined {
		for (const stmt of pf.program.body) {
			const declaration =
				stmt.type === "ExportNamedDeclaration" ? stmt.declaration : stmt;
			if (declaration?.type !== "VariableDeclaration") continue;
			for (const declarator of declaration.declarations) {
				if (
					declarator.id.type === "Identifier" &&
					declarator.id.name === name &&
					declarator.init
				) {
					return { pf, init: declarator.init };
				}
			}
		}
		const imported = this.resolveImport(pf, name);
		if (imported)
			return this.findConst(this.parse(imported.file), imported.exportName);
		return;
	}

	private resolveImport(
		pf: ParsedFile,
		name: string,
	): { file: string; exportName: string } | undefined {
		for (const stmt of pf.program.body) {
			if (stmt.type !== "ImportDeclaration") continue;
			const spec = stmt.source.value;
			if (!spec.startsWith(".")) continue;
			for (const specifier of stmt.specifiers) {
				if (
					specifier.type !== "ImportSpecifier" ||
					specifier.local.name !== name
				) {
					continue;
				}
				const base = resolve(dirname(pf.file), spec);
				const file = [
					`${base}.ts`,
					`${base}.tsx`,
					`${base}/index.ts`,
					`${base}/index.tsx`,
					base,
				].find(
					(candidate) =>
						SOURCE_EXTENSION.test(candidate) && existsSync(candidate),
				);
				if (!file) return;
				const { imported } = specifier;
				return {
					file,
					exportName:
						imported.type === "Identifier" ? imported.name : imported.value,
				};
			}
		}
		return;
	}

	/** Members of a `type X = "a" | "b"` alias declared in the file. */
	private literalUnion(pf: ParsedFile, typeName: string): string[] | undefined {
		for (const stmt of pf.program.body) {
			const declaration =
				stmt.type === "ExportNamedDeclaration" ? stmt.declaration : stmt;
			if (
				declaration?.type !== "TSTypeAliasDeclaration" ||
				declaration.id.name !== typeName
			) {
				continue;
			}
			const type = declaration.typeAnnotation;
			const members = type.type === "TSUnionType" ? type.types : [type];
			const values: string[] = [];
			for (const member of members) {
				if (
					member.type === "TSLiteralType" &&
					member.literal.type === "Literal" &&
					typeof member.literal.value === "string"
				) {
					values.push(member.literal.value);
				} else {
					return;
				}
			}
			return values;
		}
		return;
	}

	/** Name of the type reference declared for a parameter/property called `name`. */
	private declaredTypeName(pf: ParsedFile, name: string): string | undefined {
		let found: string | undefined;
		const typeNameOf = (
			annotation: { typeAnnotation: { type: string } } | null | undefined,
		): string | undefined => {
			const type = annotation?.typeAnnotation;
			return type?.type === "TSTypeReference" &&
				"typeName" in type &&
				typeof type.typeName === "object" &&
				type.typeName !== null &&
				"name" in type.typeName &&
				typeof type.typeName.name === "string"
				? type.typeName.name
				: undefined;
		};
		new Visitor({
			Identifier(node) {
				if (node.name === name) found ??= typeNameOf(node.typeAnnotation);
			},
			TSPropertySignature(node) {
				if (node.key.type === "Identifier" && node.key.name === name) {
					found ??= typeNameOf(node.typeAnnotation);
				}
			},
		}).visit(pf.program);
		return found;
	}

	private identifierPaths(
		pf: ParsedFile,
		id: { name: string; start: number },
	): string[] {
		const typeName = this.declaredTypeName(pf, id.name);
		const union = typeName ? this.literalUnion(pf, typeName) : undefined;
		if (union) return union;
		const constant = this.findConst(pf, id.name);
		if (constant) {
			const value = this.evaluate(constant.pf, constant.init);
			if (typeof value === "string") return [value];
		}
		return this.fail(
			pf,
			id,
			`path "${id.name}" cannot be resolved: type it with a union alias of string literals`,
		);
	}

	/** Every string a path argument can take: literal, literal-union identifier, or template of those. */
	resolvePaths(pf: ParsedFile, node: Wrapped): string[] {
		const expr = unwrap(node);
		if (expr.type === "Literal" && typeof expr.value === "string") {
			return [expr.value];
		}
		if (expr.type === "Identifier") return this.identifierPaths(pf, expr);
		if (expr.type === "TemplateLiteral") {
			let results = [expr.quasis[0]?.value.cooked ?? ""];
			expr.expressions.forEach((part, index) => {
				const inner = unwrap(part);
				if (inner.type !== "Identifier") {
					this.fail(pf, inner, "unsupported template path");
				}
				const values = this.identifierPaths(pf, inner);
				const suffix = expr.quasis[index + 1]?.value.cooked ?? "";
				results = results.flatMap((prefix) =>
					values.map((value) => `${prefix}${value}${suffix}`),
				);
			});
			return results;
		}
		return this.fail(pf, expr, "path argument is not static");
	}

	/** `true` unless the options argument is an object literal without a `prop` key. */
	hasOption(node: Argument | undefined, prop: string): boolean {
		if (!node) return false;
		const expr = unwrap(node);
		if (expr.type !== "ObjectExpression") return true;
		return expr.properties.some(
			(p) =>
				p.type === "Property" &&
				!p.computed &&
				p.key.type === "Identifier" &&
				p.key.name === prop,
		);
	}
}
