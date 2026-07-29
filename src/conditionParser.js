/**
 * Regex matching a '(gggg,eeee)' tag.
 */
const tagPosRegex = /\(([\dA-Fa-f]{4}),([\dA-Fa-f]{4})\)/g;

/**
 * Turn a single tag verb phrase (the text following a '(gggg,eeee)'
 *   tag reference) into a JS boolean expression on 'tag(gggg,eeee).value'.
 *
 * @param {string} tagStr The tag as '(gggg,eeee)'.
 * @param {string} verb The verb phrase, for example 'is present' or
 *   'has a Value greater than 1'.
 * @returns {string|undefined} The expression, undefined if the verb
 *   phrase is not recognised.
 */
function parseVerbExpr(tagStr, verb) {
  const v = verb.trim();
  const tagOf = `tag${tagStr}`;
  const valueOf = `${tagOf}.value`;

  // exact-match verb phrases, checked as a table rather than a chain
  // of near-identical if/regex blocks
  const simpleVerbs = [
    {regex: /^is present$/i, subject: tagOf, op: '!==', value: 'undefined'},
    {regex: /^is not present$/i, subject: tagOf, op: '===', value: 'undefined'},
    {regex: /^is empty$/i, subject: valueOf, op: '===', value: '\'\''},
    {regex: /^is not empty$/i, subject: valueOf, op: '!==', value: '\'\''}
  ];
  for (const verb of simpleVerbs) {
    if (verb.regex.test(v)) {
      return `${verb.subject} ${verb.op} ${verb.value}`;
    }
  }

  let match = v.match(/^has a value of (.+)$/i);
  if (match === null) {
    match = v.match(/^(?:at the image level )?equals (.+)$/i);
  }
  if (match !== null) {
    const exprs = match[1].split(/\s+or\s+/i)
      .map((item) => item.trim())
      .filter((item) => item.length !== 0)
      .map((alt) => `${valueOf} === '${alt}'`);
    return exprs.length > 1 ? `(${exprs.join(' || ')})` : exprs[0];
  }

  match = v.match(/^has a value (greater|lower) than ([\w.]+)$/i);
  if (match !== null) {
    const op = match[1].toLowerCase() === 'greater' ? '>' : '<';
    return `${valueOf} ${op} ${match[2]}`;
  }

  match = v.match(/^is\s+"?([^".]+?)"?$/i);
  if (match !== null) {
    const val = match[1].trim();
    // a bare 'and' means this isn't a single value but another,
    // unhandled clause tacked on (eg. 'is not present and the Code
    // Value is not a URN or URL'), so give up rather than mis-parse it
    if (/\band\b/i.test(val)) {
      return undefined;
    }
    return `${valueOf} === '${val}'`;
  }

  return undefined;
}

/**
 * Parse a condition clause (the text following 'Required if' or
 *   'Shall be present if', without the trailing period) into a JS
 *   boolean expression. Handles clauses referencing a single tag
 *   ('Context Identifier (0008,010F) is present') as well as several
 *   tags joined by 'or'/'and'
 *   ('Code Value (0008,0100) or Long Code Value (0008,0119) is present').
 *
 * @param {string} clause The condition clause.
 * @returns {string|undefined} The expression, undefined if no tag
 *   reference was found or a verb phrase could not be parsed.
 */
function parseConditionClause(clause) {
  const refs = [...clause.matchAll(tagPosRegex)];
  if (refs.length === 0) {
    return undefined;
  }

  // the text before the first tag must be (at most) that attribute's
  // name, eg. 'Context Identifier' or 'the Value of Context Group
  // Extension Flag'; anything else means the condition has a leading
  // part with no tag of its own (eg. 'the Patient is a non-human
  // organism and if Patient Species Code Sequence (0010,2202) is not
  // present'), which cannot be turned into an expression, so bail
  // entirely rather than silently dropping it
  const leading = clause.substring(0, refs[0].index).trim();
  if (leading.length !== 0 && !/^(?:the [Vv]alue of )?[A-Z][\w\s'-]*$/
    .test(leading)) {
    return undefined;
  }

  // verb phrase following each tag, and the joiner ('or'/'and') between
  // this tag's verb and the next tag's name, found by looking for the
  // last 'or'/'and' word in the gap between two consecutive tags: this
  // way an 'or' inside a verb's own value list (eg. 'equals COLOR or
  // MIXED') is not mistaken for the join between two tags, since the
  // next tag's name always sits right before its own '(gggg,eeee)'.
  const verbs = [];
  const joiners = [];
  for (let i = 0; i < refs.length; ++i) {
    const start = refs[i].index + refs[i][0].length;
    const end = i + 1 < refs.length ? refs[i + 1].index : clause.length;
    let text = clause.substring(start, end);

    if (i + 1 < refs.length) {
      const joinerMatches = [...text.matchAll(/\b(or|and)\b/gi)];
      if (joinerMatches.length === 0) {
        // unexpected shape, cannot safely split
        return undefined;
      }
      const joinerMatch = joinerMatches[joinerMatches.length - 1];
      joiners.push(joinerMatch[1].toLowerCase());
      text = text.substring(0, joinerMatch.index);
    }
    verbs.push(text.trim());
  }

  // propagate a shared trailing verb to refs left without one,
  // eg. 'Code Value (0008,0100) or Long Code Value (0008,0119) is present'
  for (let i = verbs.length - 2; i >= 0; --i) {
    if (verbs[i].length === 0) {
      verbs[i] = verbs[i + 1];
    }
  }

  const exprs = [];
  for (let i = 0; i < refs.length; ++i) {
    const tagStr = `(${refs[i][1]},${refs[i][2]})`;
    const expr = parseVerbExpr(tagStr, verbs[i]);
    if (typeof expr === 'undefined') {
      return undefined;
    }
    exprs.push(expr);
  }

  let condition = exprs[0];
  for (let i = 0; i < joiners.length; ++i) {
    condition += (joiners[i] === 'and' ? ' && ' : ' || ') + exprs[i + 1];
  }
  return condition;
}

/**
 * Extract condition arguments from a string.
 *
 * @param {string} str The string to extract the condition from.
 * @returns {object} An object containing the input string ('str')
 *   either in full or without the condition if found and
 *   the condition ('condition') if found.
 */
export function extractCondition(str) {
  const result = {str: str};

  // 'Required if Context Identifier (0008,010F) is present.'
  const reqMatch = str.match(/(Required if|Shall be present if)([^.]*)\./);

  if (reqMatch !== null) {
    const condition = parseConditionClause(reqMatch[2].trim());
    // fall back to the raw sentence if it could not be parsed
    result.condition = typeof condition !== 'undefined'
      ? condition : reqMatch[0];
    // remove matched sentence from input
    result.str = (
      str.substring(0, reqMatch.index) +
      str.substring(reqMatch.index + reqMatch[0].length)
    ).trim();
  }

  return result;
}
