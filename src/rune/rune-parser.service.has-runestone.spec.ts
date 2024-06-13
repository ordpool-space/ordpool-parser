import { readTransaction } from '../../testdata/test.helper';
import { RuneParserService } from './rune-parser.service';


describe('Rune parser', () => {

  it('should detect a runestone with real test data', () => {

    const transaction = readTransaction('2bb85f4b004be6da54f766c17c1e855187327112c231ef2ff35ebad0ea67c69e');
    expect(RuneParserService.hasRunestone(transaction)).toBe(true);
  });
});
