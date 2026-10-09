import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMcp} from '../lib/motion-mcp';
test('Motion MCP accepts JSON and SSE while matching the request ID',()=>{assert.deepEqual(parseMcp('{"jsonrpc":"2.0","id":2,"result":{"tools":[]}}',2),{tools:[]});assert.deepEqual(parseMcp('event: message\r\ndata: {"jsonrpc":"2.0","method":"notification"}\r\n\r\nevent: message\r\ndata: {"jsonrpc":"2.0","id":3,"result":{"tools":[]}}\r\n\r\n',3),{tools:[]});assert.throws(()=>parseMcp('{"id":4,"result":{}}',3));assert.throws(()=>parseMcp('{"id":3,"error":{"message":"bad token"}}',3));});
