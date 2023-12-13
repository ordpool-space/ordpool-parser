import axios from 'axios';
import { InscriptionParserService } from './inscription-parser.service';


describe('Real data usage example (see README)', () => {
  it('shows you how to use the parser with axios', async () => {

    async function getInscription(txId: string) {

      const response = await axios.get(`https://mempool.space/api/tx/${txId}`);
      const transaction = response.data;

      const parser = new InscriptionParserService();
      const parsedInscription = parser.parseInscription(transaction);

      return parsedInscription;
    }

    const parsedInscription = await getInscription('f1997166547da9784a3e7419d2b248551565211811d4f5e705b685efa244451f');

    if (!parsedInscription) {
      console.log('No inscription found!');
    } else {
      // Output: text/html;charset=utf-8
      // console.log(parsedInscription.contentType);

      // UTF-8 encoded string (not intended for binary content like images or videos)
      // Output: <html><!--cubes.haushoppe.art--><body> [...]
      // console.log(parsedInscription.getContentString());

      // Base64 encoded data URI that can be displayed in an iframe
      // Output: data:text/html;charset=utf-8;base64,PGh0bWw+PCEtLWN1YmVzLmhhdXNob3BwZS5hcnQtLT48Ym9keT4 [...]
      // console.log(parsedInscription.getDataUri());
    }

    expect(parsedInscription?.contentType).toBe('text/html;charset=utf-8');
    expect(parsedInscription?.getContentString()).toBe("<html><!--cubes.haushoppe.art--><body><script>t='ab2f4e9dce0583264078428a91aa9037da0e75f90dc77fe3cba7cf5320ad003di0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0|dda7470b6d5bbeea6560a167f56a048aa29ce71f57edc7b71cf5df365ddbddaei0'</script><script src=/content/9475aa8df559d569f7284ce59e97014f28be758e832e212fdbba0202699dd035i0></script>");
    expect(parsedInscription?.getDataUri()).toBe('data:text/html;charset=utf-8;base64,PGh0bWw+PCEtLWN1YmVzLmhhdXNob3BwZS5hcnQtLT48Ym9keT48c2NyaXB0PnQ9J2FiMmY0ZTlkY2UwNTgzMjY0MDc4NDI4YTkxYWE5MDM3ZGEwZTc1ZjkwZGM3N2ZlM2NiYTdjZjUzMjBhZDAwM2RpMHxkZGE3NDcwYjZkNWJiZWVhNjU2MGExNjdmNTZhMDQ4YWEyOWNlNzFmNTdlZGM3YjcxY2Y1ZGYzNjVkZGJkZGFlaTB8ZGRhNzQ3MGI2ZDViYmVlYTY1NjBhMTY3ZjU2YTA0OGFhMjljZTcxZjU3ZWRjN2I3MWNmNWRmMzY1ZGRiZGRhZWkwfGRkYTc0NzBiNmQ1YmJlZWE2NTYwYTE2N2Y1NmEwNDhhYTI5Y2U3MWY1N2VkYzdiNzFjZjVkZjM2NWRkYmRkYWVpMHxkZGE3NDcwYjZkNWJiZWVhNjU2MGExNjdmNTZhMDQ4YWEyOWNlNzFmNTdlZGM3YjcxY2Y1ZGYzNjVkZGJkZGFlaTB8ZGRhNzQ3MGI2ZDViYmVlYTY1NjBhMTY3ZjU2YTA0OGFhMjljZTcxZjU3ZWRjN2I3MWNmNWRmMzY1ZGRiZGRhZWkwJzwvc2NyaXB0PjxzY3JpcHQgc3JjPS9jb250ZW50Lzk0NzVhYThkZjU1OWQ1NjlmNzI4NGNlNTllOTcwMTRmMjhiZTc1OGU4MzJlMjEyZmRiYmEwMjAyNjk5ZGQwMzVpMD48L3NjcmlwdD4=');
  });
});
