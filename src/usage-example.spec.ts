/**
 * @jest-environment node
 *
 * Node-only by design. We need real `fetch`, which jsdom still doesn't
 * implement in 2026 (issue jsdom/jsdom#1724 -- open since 2017, latest
 * comment 2026-04-06 still recommending the JSDOMEnvironment-subclass
 * workaround). Node has fetch natively, so this spec just runs there.
 *
 * The parser-logic part of "does this work in a browser?" is verified by
 * the other 800+ specs that exercise pure parsing against on-disk
 * fixtures in the jsdom config -- those don't need fetch. This single
 * spec is a real-world HTTP integration test, by definition a node-side
 * concern.
 */
import { InscriptionParserService } from './inscription/inscription-parser.service';

/**
 * Mirrors the README's "Quick start" snippet. Hits api.ordpool.space (our
 * own Esplora-compatible backend, no third-party piracy) and parses a
 * real inscription that's been on chain since well before this test was
 * written. If the README example ever drifts from working code, this
 * test fires.
 */
describe('Real data usage example (see README)', () => {

  it('shows how to use the parser with fetch + api.ordpool.space', async () => {

    async function getInscriptions(txId: string) {
      const response = await fetch(`https://api.ordpool.space/api/tx/${txId}`);
      const transaction = await response.json();
      return InscriptionParserService.parse(transaction);
    }

    const parsedInscriptions = await getInscriptions(
      'f1997166547da9784a3e7419d2b248551565211811d4f5e705b685efa244451f',
    );

    expect(parsedInscriptions.length).toBeGreaterThan(0);
    expect(parsedInscriptions[0].contentType).toBe('text/html;charset=utf-8');
    expect(await parsedInscriptions[0].getContent()).toBe(
      "<html><!--cubes.haushoppe.art--><body><script>t='ab2f4e9dce0583264078428a91aa9037da0e75f90dc77fe3cba7cf5320ad003di0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0'</script><script src=/content/9475aa8df559d569f7284ce59e97014f28be758e832e212fdbba0202699dd035i0></script>"
    );
    expect(await parsedInscriptions[0].getDataUri()).toBe(
      'data:text/html;charset=utf-8;base64,PGh0bWw+PCEtLWN1YmVzLmhhdXNob3BwZS5hcnQtLT48Ym9keT48c2NyaXB0PnQ9J2FiMmY0ZTlkY2UwNTgzMjY0MDc4NDI4YTkxYWE5MDM3ZGEwZTc1ZjkwZGM3N2ZlM2NiYTdjZjUzMjBhZDAwM2RpMHxkZGE3NDcwYjZkNWJiZWVhNjU2MGExNjdmNTZhMDQ4YWEyOWNlNzFmNTdlZGM3YjcxY2Y1ZGYzNjVkZGJkZGFlaTB8ZGRhNzQ3MGI2ZDViYmVlYTY1NjBhMTY3ZjU2YTA0OGFhMjljZTcxZjU3ZWRjN2I3MWNmNWRmMzY1ZGRiZGRhZWkwfGRkYTc0NzBiNmQ1YmJlZWE2NTYwYTE2N2Y1NmEwNDhhYTI5Y2U3MWY1N2VkYzdiNzFjZjVkZjM2NWRkYmRkYWVpMHxkZGE3NDcwYjZkNWJiZWVhNjU2MGExNjdmNTZhMDQ4YWEyOWNlNzFmNTdlZGM3YjcxY2Y1ZGYzNjVkZGJkZGFlaTB8ZGRhNzQ3MGI2ZDViYmVlYTY1NjBhMTY3ZjU2YTA0OGFhMjljZTcxZjU3ZWRjN2I3MWNmNWRmMzY1ZGRiZGRhZWkwJzwvc2NyaXB0PjxzY3JpcHQgc3JjPS9jb250ZW50Lzk0NzVhYThkZjU1OWQ1NjlmNzI4NGNlNTllOTcwMTRmMjhiZTc1OGU4MzJlMjEyZmRiYmEwMjAyNjk5ZGQwMzVpMD48L3NjcmlwdD4='
    );
  });
});
