/**
 * @test-kind unit
 * Real:   InscriptionParserService, called the way the README "Quick start" shows (fetch, response.json(), parse)
 * Faked:  global fetch -> a real Response carrying testdata/tx_f1997166547da9784a3e7419d2b248551565211811d4f5e705b685efa244451f.json,
 *         captured with curl from https://api.ordpool.space/api/tx/f1997166547da9784a3e7419d2b248551565211811d4f5e705b685efa244451f
 *         on 2026-10-10 (HTTP 200, application/json, mempool-electrs 3.4.0-dev), stored as pretty-printed JSON like fetch-tx-testdata.js does
 * Proves: the README example turns a fetched Esplora transaction into the inscription's content type, content and data URI
 *
 * @jest-environment node
 *
 * Node environment because the fake returns a native `Response`, which jsdom does not provide
 * (jsdom/jsdom#1724). The other specs cover the parser itself in the jsdom config.
 */
import fs from 'fs';

import { InscriptionParserService } from './inscription/inscription-parser.service';

const TX_ID = 'f1997166547da9784a3e7419d2b248551565211811d4f5e705b685efa244451f';

/**
 * An Esplora-compatible backend the consumer points the README snippet at. The `.test` TLD is
 * reserved (RFC 2606) and never resolves, so no request can leave the machine even if the fake
 * below were bypassed.
 */
const ESPLORA_BASE_URL = 'https://esplora.test';

/**
 * Serves the captured response for exactly the one URL the example requests and rejects every
 * other URL, so an unexpected request fails the test instead of reaching the network.
 */
function fakeFetchFromCapturedFixture(input: string | URL | Request): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url !== `${ESPLORA_BASE_URL}/api/tx/${TX_ID}`) {
    return Promise.reject(new Error(`unexpected request in usage example: ${url}`));
  }
  const body = fs.readFileSync(`testdata/tx_${TX_ID}.json`, 'utf8');
  return Promise.resolve(new Response(body, { status: 200, headers: { 'content-type': 'application/json' } }));
}

/**
 * Mirrors the README's "Quick start" snippet: fetch a transaction from an Esplora-compatible
 * backend and parse it. If the README example drifts from working code, this test fires.
 */
describe('Real data usage example (see README)', () => {

  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(fakeFetchFromCapturedFixture);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('shows how to use the parser with fetch + an Esplora-compatible backend', async () => {

    async function getInscriptions(txId: string) {
      const response = await fetch(`${ESPLORA_BASE_URL}/api/tx/${txId}`);
      const transaction = await response.json();
      return InscriptionParserService.parse(transaction);
    }

    const parsedInscriptions = await getInscriptions(TX_ID);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(`${ESPLORA_BASE_URL}/api/tx/${TX_ID}`);

    expect(parsedInscriptions.length).toBe(1);
    expect(parsedInscriptions[0].contentType).toBe('text/html;charset=utf-8');
    expect(await parsedInscriptions[0].getContent()).toBe(
      "<html><!--cubes.haushoppe.art--><body><script>t='ab2f4e9dce0583264078428a91aa9037da0e75f90dc77fe3cba7cf5320ad003di0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0'</script><script src=/content/9475aa8df559d569f7284ce59e97014f28be758e832e212fdbba0202699dd035i0></script>"
    );
    expect(await parsedInscriptions[0].getDataUri()).toBe(
      'data:text/html;charset=utf-8;base64,PGh0bWw+PCEtLWN1YmVzLmhhdXNob3BwZS5hcnQtLT48Ym9keT48c2NyaXB0PnQ9J2FiMmY0ZTlkY2UwNTgzMjY0MDc4NDI4YTkxYWE5MDM3ZGEwZTc1ZjkwZGM3N2ZlM2NiYTdjZjUzMjBhZDAwM2RpMHxkZGE3NDcwYjZkNWJiZWVhNjU2MGExNjdmNTZhMDQ4YWEyOWNlNzFmNTdlZGM3YjcxY2Y1ZGYzNjVkZGJkZGFlaTB8ZGRhNzQ3MGI2ZDViYmVlYTY1NjBhMTY3ZjU2YTA0OGFhMjljZTcxZjU3ZWRjN2I3MWNmNWRmMzY1ZGRiZGRhZWkwfGRkYTc0NzBiNmQ1YmJlZWE2NTYwYTE2N2Y1NmEwNDhhYTI5Y2U3MWY1N2VkYzdiNzFjZjVkZjM2NWRkYmRkYWVpMHxkZGE3NDcwYjZkNWJiZWVhNjU2MGExNjdmNTZhMDQ4YWEyOWNlNzFmNTdlZGM3YjcxY2Y1ZGYzNjVkZGJkZGFlaTB8ZGRhNzQ3MGI2ZDViYmVlYTY1NjBhMTY3ZjU2YTA0OGFhMjljZTcxZjU3ZWRjN2I3MWNmNWRmMzY1ZGRiZGRhZWkwJzwvc2NyaXB0PjxzY3JpcHQgc3JjPS9jb250ZW50Lzk0NzVhYThkZjU1OWQ1NjlmNzI4NGNlNTllOTcwMTRmMjhiZTc1OGU4MzJlMjEyZmRiYmEwMjAyNjk5ZGQwMzVpMD48L3NjcmlwdD4='
    );
  });
});
