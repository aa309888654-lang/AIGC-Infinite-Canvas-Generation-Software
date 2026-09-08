// SEC C-2 修复：受限表达式求值器
//
// 安全最佳实践：禁止使用 `new Function()` 或 `eval()` 执行用户输入的表达式，
// 因为它们可以访问全局对象（window, fetch, process 等），导致任意代码执行。
//
// 本求值器仅支持白名单语法（字面量、标识符、成员/索引访问、算术/比较/逻辑运算），
// 标识符只能从传入的 context 中查找，无法访问任何全局对象。
// 不支持：函数调用、new、赋值、箭头函数、模板字符串、await/import 等。

export type EvaluatorValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | EvaluatorValue[]
  | { [key: string]: EvaluatorValue };

interface Token {
  type: 'number' | 'string' | 'boolean' | 'null' | 'identifier' | 'operator' | 'punctuation';
  value: string;
  pos: number;
}

const OPERATORS = new Set([
  '||', '&&', '==', '!=', '===', '!==', '<', '>', '<=', '>=',
  '+', '-', '*', '/', '%', '!', '.', '[', ']', '(', ')',
]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    // 空白
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // 数字
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(input[i + 1] ?? ''))) {
      let num = '';
      while (i < len && /[0-9.eE+-]/.test(input[i])) {
        // 仅在合法位置接受 +/-
        if ((input[i] === '+' || input[i] === '-') && !/[eE]/.test(input[i - 1] ?? '')) break;
        num += input[i];
        i++;
      }
      const value = Number(num);
      if (Number.isNaN(value)) {
        throw new Error(`无效数字字面量: ${num}`);
      }
      tokens.push({ type: 'number', value: num, pos: i - num.length });
      continue;
    }

    // 字符串（单引号或双引号）
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let str = '';
      i++;
      while (i < len && input[i] !== quote) {
        if (input[i] === '\\') {
          const next = input[i + 1];
          if (next === undefined) throw new Error('字符串未闭合的反斜杠');
          const escapes: Record<string, string> = {
            n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', 0: '\0',
          };
          str += escapes[next] ?? next;
          i += 2;
        } else {
          str += input[i];
          i++;
        }
      }
      if (i >= len) throw new Error('字符串未闭合');
      i++; // 跳过结束引号
      tokens.push({ type: 'string', value: str, pos: i - str.length - 2 });
      continue;
    }

    // 标识符（含 true/false/null）
    if (/[a-zA-Z_$]/.test(ch)) {
      let id = '';
      while (i < len && /[a-zA-Z0-9_$]/.test(input[i])) {
        id += input[i];
        i++;
      }
      if (id === 'true' || id === 'false') {
        tokens.push({ type: 'boolean', value: id, pos: i - id.length });
      } else if (id === 'null') {
        tokens.push({ type: 'null', value: id, pos: i - id.length });
      } else if (id === 'undefined') {
        tokens.push({ type: 'null', value: id, pos: i - id.length });
      } else {
        tokens.push({ type: 'identifier', value: id, pos: i - id.length });
      }
      continue;
    }

    // 运算符（多字符优先）
    const three = input.slice(i, i + 3);
    const two = input.slice(i, i + 2);
    if (three === '===' || three === '!==') {
      tokens.push({ type: 'operator', value: three, pos: i });
      i += 3;
      continue;
    }
    if (OPERATORS.has(two)) {
      tokens.push({ type: 'operator', value: two, pos: i });
      i += 2;
      continue;
    }
    if (OPERATORS.has(ch)) {
      tokens.push({ type: ch === '.' || ch === '[' || ch === ']' || ch === '(' || ch === ')' ? 'punctuation' : 'operator', value: ch, pos: i });
      i++;
      continue;
    }

    throw new Error(`非法字符: ${ch} (位置 ${i})`);
  }

  return tokens;
}

// AST 节点
type Node =
  | { kind: 'literal'; value: EvaluatorValue }
  | { kind: 'identifier'; name: string }
  | { kind: 'member'; object: Node; property: Node; computed: boolean }
  | { kind: 'unary'; op: string; argument: Node }
  | { kind: 'binary'; op: string; left: Node; right: Node };

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): Node {
    const node = this.parseLogicalOr();
    if (this.pos < this.tokens.length) {
      throw new Error(`意外的标记: ${this.tokens[this.pos].value}`);
    }
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    const token = this.tokens[this.pos];
    if (!token) throw new Error('意外的输入结束');
    this.pos++;
    return token;
  }

  private matchOperator(...ops: string[]): boolean {
    const token = this.peek();
    if (token && (token.type === 'operator' || token.type === 'punctuation') && ops.includes(token.value)) {
      this.pos++;
      return true;
    }
    return false;
  }

  private parseLogicalOr(): Node {
    let left = this.parseLogicalAnd();
    while (this.matchOperator('||')) {
      const right = this.parseLogicalAnd();
      left = { kind: 'binary', op: '||', left, right };
    }
    return left;
  }

  private parseLogicalAnd(): Node {
    let left = this.parseEquality();
    while (this.matchOperator('&&')) {
      const right = this.parseEquality();
      left = { kind: 'binary', op: '&&', left, right };
    }
    return left;
  }

  private parseEquality(): Node {
    let left = this.parseComparison();
    for (;;) {
      const op = this.peek()?.value;
      if (op === '==' || op === '!=' || op === '===' || op === '!==') {
        this.consume();
        const right = this.parseComparison();
        left = { kind: 'binary', op, left, right };
      } else break;
    }
    return left;
  }

  private parseComparison(): Node {
    let left = this.parseAdditive();
    for (;;) {
      const op = this.peek()?.value;
      if (op === '<' || op === '>' || op === '<=' || op === '>=') {
        this.consume();
        const right = this.parseAdditive();
        left = { kind: 'binary', op, left, right };
      } else break;
    }
    return left;
  }

  private parseAdditive(): Node {
    let left = this.parseMultiplicative();
    for (;;) {
      const op = this.peek()?.value;
      if (op === '+' || op === '-') {
        this.consume();
        const right = this.parseMultiplicative();
        left = { kind: 'binary', op, left, right };
      } else break;
    }
    return left;
  }

  private parseMultiplicative(): Node {
    let left = this.parseUnary();
    for (;;) {
      const op = this.peek()?.value;
      if (op === '*' || op === '/' || op === '%') {
        this.consume();
        const right = this.parseUnary();
        left = { kind: 'binary', op, left, right };
      } else break;
    }
    return left;
  }

  private parseUnary(): Node {
    const op = this.peek()?.value;
    if (op === '!' || op === '-') {
      this.consume();
      const argument = this.parseUnary();
      return { kind: 'unary', op, argument };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Node {
    let node = this.parsePrimary();
    for (;;) {
      if (this.matchOperator('.')) {
        const propToken = this.consume();
        if (propToken.type !== 'identifier') {
          throw new Error(`属性访问后必须是标识符，得到: ${propToken.value}`);
        }
        node = { kind: 'member', object: node, property: { kind: 'literal', value: propToken.value }, computed: false };
      } else if (this.matchOperator('[')) {
        const property = this.parseLogicalOr();
        if (!this.matchOperator(']')) {
          throw new Error('索引访问缺少右括号 ]');
        }
        node = { kind: 'member', object: node, property, computed: true };
      } else break;
    }
    return node;
  }

  private parsePrimary(): Node {
    const token = this.peek();
    if (!token) throw new Error('意外的输入结束');

    if (token.type === 'number') {
      this.consume();
      return { kind: 'literal', value: Number(token.value) };
    }
    if (token.type === 'string') {
      this.consume();
      return { kind: 'literal', value: token.value };
    }
    if (token.type === 'boolean') {
      this.consume();
      return { kind: 'literal', value: token.value === 'true' };
    }
    if (token.type === 'null') {
      this.consume();
      return { kind: 'literal', value: null };
    }
    if (token.type === 'identifier') {
      this.consume();
      return { kind: 'identifier', name: token.value };
    }
    if (token.type === 'punctuation' && token.value === '(') {
      this.consume();
      const node = this.parseLogicalOr();
      if (!this.matchOperator(')')) {
        throw new Error('缺少右括号 )');
      }
      return node;
    }
    throw new Error(`意外的标记: ${token.value} (类型 ${token.type})`);
  }
}

function evaluate(node: Node, context: Record<string, unknown>): unknown {
  switch (node.kind) {
    case 'literal':
      return node.value;
    case 'identifier': {
      if (!(node.name in context)) {
        throw new Error(`未知变量: ${node.name}`);
      }
      return context[node.name];
    }
    case 'member': {
      const obj = evaluate(node.object, context);
      const prop = evaluate(node.property, context);
      if (obj == null) return undefined;
      if (typeof obj !== 'object') {
        throw new Error(`对非对象值进行成员访问`);
      }
      return (obj as Record<string, unknown>)[prop as string];
    }
    case 'unary': {
      const v = evaluate(node.argument, context);
      if (node.op === '!') return !v;
      if (node.op === '-') return -v;
      throw new Error(`未知一元运算符: ${node.op}`);
    }
    case 'binary': {
      // 短路求值
      if (node.op === '&&') {
        return evaluate(node.left, context) && evaluate(node.right, context);
      }
      if (node.op === '||') {
        return evaluate(node.left, context) || evaluate(node.right, context);
      }
      const left = evaluate(node.left, context);
      const right = evaluate(node.right, context);
      switch (node.op) {
        case '+': return (left as number) + (right as number);
        case '-': return (left as number) - (right as number);
        case '*': return (left as number) * (right as number);
        case '/': return (left as number) / (right as number);
        case '%': return (left as number) % (right as number);
        case '<': return (left as number) < (right as number);
        case '>': return (left as number) > (right as number);
        case '<=': return (left as number) <= (right as number);
        case '>=': return (left as number) >= (right as number);
        case '==': return left == right; // eslint-disable-line eqeqeq
        case '!=': return left != right; // eslint-disable-line eqeqeq
        case '===': return left === right;
        case '!==': return left !== right;
        default: throw new Error(`未知运算符: ${node.op}`);
      }
    }
  }
}

/**
 * 安全地求值用户输入的条件表达式。
 *
 * 仅支持：字面量、标识符、成员/索引访问、一元 !/-、
 * 算术 + - * / %、比较 < > <= >= == === != !==、逻辑 && ||。
 *
 * 标识符只能从 context 中查找，无法访问全局对象。
 * 不支持函数调用、new、赋值、箭头函数等。
 *
 * @throws 若表达式语法非法或引用未知变量
 */
export function safeEvaluateExpression(expression: string, context: Record<string, unknown>): unknown {
  const trimmed = expression.trim();
  if (!trimmed) {
    throw new Error('表达式为空');
  }
  const tokens = tokenize(trimmed);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  return evaluate(ast, context);
}

/**
 * 安全求值并返回布尔结果，失败返回 false。
 * 适用于断点条件等"失败即不触发"的场景。
 */
export function safeEvaluateCondition(expression: string, context: Record<string, unknown>): boolean {
  try {
    const result = safeEvaluateExpression(expression, context);
    return Boolean(result);
  } catch (error) {
    console.error('[SafeExpression] 条件求值失败:', error);
    return false;
  }
}
