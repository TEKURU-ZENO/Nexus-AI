import { describe, expect, it } from 'vitest';

import { parseFrame } from './sse';

describe('parseFrame', () => {
  it('parses id and multi-line data', () => {
    expect(parseFrame('id: 7\nevent: critique\ndata: {"a":\ndata: 1}')).toEqual({ id: 7, data: '{"a":\n1}' });
  });
  it('ignores comments and retry lines', () => {
    expect(parseFrame(': ping')).toEqual({ id: undefined, data: undefined });
    expect(parseFrame('retry: 3000')).toEqual({ id: undefined, data: undefined });
  });
});
