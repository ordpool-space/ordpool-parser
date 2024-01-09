import axios from 'axios';
import { InscriptionParserService } from './inscription-parser.service';


describe.skip('Real data usage example (see README)', () => {
  it('shows you how to use the parser with axios', async () => {

    async function getInscriptions(txId: string) {

      const response = await axios.get(`https://mempool.space/api/tx/${txId}`);
      const transaction = response.data;

      return InscriptionParserService.parseInscriptions(transaction);
    }

    const parsedInscriptions = await getInscriptions('f1997166547da9784a3e7419d2b248551565211811d4f5e705b685efa244451f');

    if (!parsedInscriptions.length) {
      console.log('No inscription found!');
    } else {

      /*
      // Output: text/html;charset=utf-8
      console.log(parsedInscriptions[0].contentType);

      // UTF-8 encoded string (not intended for binary content like images or videos)
      // Output: <html><!--cubes.haushoppe.art--><body> [...]
      console.log(parsedInscriptions[0].getContentString());

      // Base64 encoded data URI that can be displayed in an iframe
      // Output: data:text/html;charset=utf-8;base64,PGh0bWw+PCEtLWN1YmVzLmhhdXNob3BwZS5hcnQtLT48Ym9keT4 [...]
      console.log(parsedInscriptions[0].getDataUri());
      */
    }

    expect(parsedInscriptions[0].contentType).toBe('text/html;charset=utf-8');
    expect(parsedInscriptions[0].getContent()).toBe("<html><!--cubes.haushoppe.art--><body><script>t='ab2f4e9dce0583264078428a91aa9037da0e75f90dc77fe3cba7cf5320ad003di0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0'</script><script src=/content/9475aa8df559d569f7284ce59e97014f28be758e832e212fdbba0202699dd035i0></script>");
    expect(parsedInscriptions[0].getDataUri()).toBe('data:text/html;charset=utf-8;base64,PGh0bWw+PCEtLWN1YmVzLmhhdXNob3BwZS5hcnQtLT48Ym9keT48c2NyaXB0PnQ9J2FiMmY0ZTlkY2UwNTgzMjY0MDc4NDI4YTkxYWE5MDM3ZGEwZTc1ZjkwZGM3N2ZlM2NiYTdjZjUzMjBhZDAwM2RpMHxkZGE3NDcwYjZkNWJiZWVhNjU2MGExNjdmNTZhMDQ4YWEyOWNlNzFmNTdlZGM3YjcxY2Y1ZGYzNjVkZGJkZGFlaTB8ZGRhNzQ3MGI2ZDViYmVlYTY1NjBhMTY3ZjU2YTA0OGFhMjljZTcxZjU3ZWRjN2I3MWNmNWRmMzY1ZGRiZGRhZWkwfGRkYTc0NzBiNmQ1YmJlZWE2NTYwYTE2N2Y1NmEwNDhhYTI5Y2U3MWY1N2VkYzdiNzFjZjVkZjM2NWRkYmRkYWVpMHxkZGE3NDcwYjZkNWJiZWVhNjU2MGExNjdmNTZhMDQ4YWEyOWNlNzFmNTdlZGM3YjcxY2Y1ZGYzNjVkZGJkZGFlaTB8ZGRhNzQ3MGI2ZDViYmVlYTY1NjBhMTY3ZjU2YTA0OGFhMjljZTcxZjU3ZWRjN2I3MWNmNWRmMzY1ZGRiZGRhZWkwJzwvc2NyaXB0PjxzY3JpcHQgc3JjPS9jb250ZW50Lzk0NzVhYThkZjU1OWQ1NjlmNzI4NGNlNTllOTcwMTRmMjhiZTc1OGU4MzJlMjEyZmRiYmEwMjAyNjk5ZGQwMzVpMD48L3NjcmlwdD4=');
  });
});
