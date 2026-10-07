/** RFC 8259 syntax plus Studio's stricter interoperability profile. */
export function parseJSONStrict(input, {maxBytes = 20 * 1024 * 1024} = {}) {
  const size = typeof input === 'string' ? Buffer.byteLength(input, 'utf8') : input.byteLength;
  if (size > maxBytes) throw new Error('JSON input exceeds the configured byte limit');
  const content = typeof input === 'string' ? input : new TextDecoder('utf-8', {fatal:true}).decode(input);
  // Native parsing owns the grammar; enforce the depth bound before allowing it
  // to allocate a deeply nested object graph. Token alternatives are disjoint.
  const tokens = /"(?:\\[\s\S]|[^"\\])*"|[{}\[\],:]|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g;
  const stack = [];
  for (const match of content.matchAll(tokens)) {
    const token = match[0];
    if (token === '{' || token === '[') {
      stack.push({names:token === '{' ? new Set() : null, expectsName:token === '{'});
      if (stack.length > 128) throw new Error('JSON nesting exceeds 128 levels');
    } else if (token === '}' || token === ']') {
      stack.pop();
    } else if (token === ',') {
      if (stack.at(-1)?.names) stack.at(-1).expectsName = true;
    } else if (token.startsWith('"')) {
      const value = JSON.parse(token);
      for (let i=0; i<value.length; i++) {
        const code=value.charCodeAt(i);
        if (code>=0xd800 && code<=0xdbff) {
          const next=value.charCodeAt(++i);
          if (!(next>=0xdc00 && next<=0xdfff)) throw new Error('JSON contains an unpaired Unicode surrogate');
        } else if (code>=0xdc00 && code<=0xdfff) throw new Error('JSON contains an unpaired Unicode surrogate');
      }
      const object=stack.at(-1);
      if (object?.names && object.expectsName) {
        if (object.names.has(value)) throw new Error('JSON contains a duplicate object member');
        object.names.add(value);
        object.expectsName=false;
      }
    } else if (/^-?\d/.test(token)) {
      const number=Number(token);
      if (!Number.isFinite(number) || (Number.isInteger(number) && !Number.isSafeInteger(number))) {
        throw new Error('JSON number is outside the finite, safe-integer interoperability profile');
      }
    }
  }
  return JSON.parse(content);
}
