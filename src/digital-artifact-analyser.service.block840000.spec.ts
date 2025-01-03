import axios from 'axios';
import { log, warn } from 'console';

import { getBlock840000Txns } from '../testdata/block_840000_txns';
import { DigitalArtifactAnalyserService } from './digital-artifact-analyser.service';
import { DigitalArtifactsParserService } from './digital-artifacts-parser.service';
import { RuneParserService } from './rune/rune-parser.service';
import { removeSpacers } from './rune/rune-parser.service.helper';
import { Network } from './rune/src/network';
import { DigitalArtifact, DigitalArtifactType } from './types/digital-artifact';
import { IEsploraApi } from './types/mempool';
import { ParsedRunestone } from './types/parsed-runestone';
import { OrdpoolStats } from './types/ordpool-stats';
import { getRawBlock840000 } from '../testdata/block_84000_from_rpc';
import { convertVerboseBlockToSimplePlus } from './lib/bitcoin-rpc';

describe('DigitalArtifacts Parser', () => {

  // Helper to perform assertions on ordpoolStats
  const assertOrdpoolStats = (ordpoolStats: OrdpoolStats) => {

    // 878 inscriptions according ordinals.com
    expect(ordpoolStats.amounts.inscription).toBe(878);

    // 689 runes according ordinals.com -- all 66 invalid ronestones are identified in the next test
    expect(ordpoolStats.amounts.runeEtch).toBe(755);

    // i havent verified all of these numbers, but at least we know that something has changed, if this object differs
    expect(ordpoolStats.amounts).toEqual({
      atomical: 0,
      atomicalMint: 0,
      atomicalTransfer: 0,
      atomicalUpdate: 0,
      cat21: 5,
      cat21Mint: 5,
      cat21Transfer: 0,
      inscription: 878,
      inscriptionMint: 878,
      inscriptionTransfer: 0,
      inscriptionBurn: 0,
      rune: 2004,
      runeEtch: 755,
      runeMint: 1197,
      runeCenotaph: 0,
      runeTransfer: 0,
      runeBurn: 0,
      brc20: 17,
      brc20Deploy: 3,
      brc20Mint: 10,
      brc20Transfer: 4,
      src20: 0,
      src20Deploy: 0,
      src20Mint: 0,
      src20Transfer: 0
    });

    expect(ordpoolStats.runes.runeEtchAttempts.length).toBe(755);

    const zzFEHU = ordpoolStats.runes.runeEtchAttempts[0];
    expect(zzFEHU.runeId).toBe('840000:1');
    expect(zzFEHU.runeName).toBe('Z•Z•Z•Z•Z•FEHU•Z•Z•Z•Z•Z');
    expect(zzFEHU.txId).toBe('2bb85f4b004be6da54f766c17c1e855187327112c231ef2ff35ebad0ea67c69e');

    expect(ordpoolStats.cat21.cat21MintActivity?.length).toBe(5);

    const redBeauty = ordpoolStats.cat21.cat21MintActivity ? ordpoolStats.cat21.cat21MintActivity[0] : undefined;
    expect(redBeauty?.transactionId).toBe('90b7a074efadb6f2be4ac784140d257d2871ff1d06f5320cba9f5ac5e1c1d27a');
    expect(Math.round(redBeauty?.feeRate || 0)).toBe(251);
    expect(redBeauty?.firstOwner).toBe('bc1pse8ugn3ns6f2t2w0dls8at7fymdmtnnj0x0mcesfv7j8csm98mfs5tv8dr');
    expect(redBeauty?.fee).toBe(44250);
    expect(redBeauty?.traits.catColors[2]).toBe('#d61017');

  }

  /*
   * This test uses all transactions of the halving block 840000, which has a lot of runes activity
   * The data is a snapshot of the data that Blocks.$getBlockExtended receives from Blocks.$updateBlocks()
   *
   * see https://ordinals.com/block/840000
   */
  it('should count all artifacts in block 840,000, provided by the mempool backend (esplora API)', async () => {

    var transactions = getBlock840000Txns();

    const start = performance.now();
    var ordpoolStats = await DigitalArtifactAnalyserService.analyseTransactions(transactions);
    const end = performance.now();
    warn(`Block 840,000 txns (analyseTransactions with esplora data) – Execution time: ${(end - start) / 100} ms`);

    assertOrdpoolStats(ordpoolStats);
  });

  it('should count all artifacts in block 840,000, provided by the Bitcoin RPC (verboseBlock)', async () => {

    const verboseBlock = getRawBlock840000();
    const transactions = convertVerboseBlockToSimplePlus(verboseBlock);

    const start = performance.now();
    var ordpoolStats = await DigitalArtifactAnalyserService.analyseTransactions(transactions);
    const end = performance.now();
    warn(`Block 840,000 txns (analyseTransactions with RPC data) – Execution time: ${(end - start) / 100} ms`);

    assertOrdpoolStats(ordpoolStats);
  });

  /*
   * We finally came to the same results as ord!
   *
   * -> Amount of raw etchings in block 840,000: 755
   * -> Successful etchings in block 840,000: 689
   * -> Invalid runestones: 66
   *
   * Here are all 66 invalid runestones, and the exact reason.
   * Note: This is an integration test that loads data via HTTP. It's very slow!
   *
   * Invalid rune in 2918ee2072b4bbe67db35771993c5467f4b69e9b3d889941bb3c081412fea448 – BITCOIN•WIF•HAT – NameAlreadyTaken
   * Invalid rune in d60988aec4c37d3a142e263c1f9020adcfd08890f5a0cdd2d694580a4d568af8 – DOG•DOG•DOG•DOG•DOG•DOG•DOG•DOG•DOG – ReservedRuneName
   * Invalid rune in 34e9371a7c070e3af2b3eafa44e7d6b321776b3dcc81eb07952afe2bdad561a2 – LLAMAS•WIF•HATS – CommitmentNotFound
   * Invalid rune in 7016cfd34168a7b4a0f4fd6dfc4e1711a2b9736a011b80362077d26677565d44 – RUNI•ANTI•MEMES – CommitmentNotFound
   * Invalid rune in fe32008e29beb87cfc3503034457ef8b3ec9221356310a24552609a56bba4189 – SATOSHI•NAKAMOTO – NameAlreadyTaken
   * Invalid rune in 661c75a903ed8dee71bf5057caa6dbac2a6ce9ff6dcbe37fea4b6af2b7620951 – MAGIC•INTERNET•MONEY – NameAlreadyTaken
   * Invalid rune in bf8ae553a62d89b08fd4f881c18f6d55e9cc4ae44099f657285a3953b46537c0 – SATOSHI•NAKAMOTO – NameAlreadyTaken
   * Invalid rune in 0198301e8d84f719847d2ada7d1d6747407ed5a4d1468fca1c900be65505b6f7 – GET•RICH•TOGETHER – NameAlreadyTaken
   * Invalid rune in c1843d403351302cfda9aa8d1270b24ea57675e8a206bff942e19133a8ac4bd3 – CAI•YUAN•GUANG•JIN – NameAlreadyTaken
   * Invalid rune in c171dbb922dc4e999e93e242c38783e465078e6477daa082df8f8b8b05f656e4 – SATOSHI•NAKAMOTO – NameAlreadyTaken
   * Invalid rune in 27bbb1f7776d3ac5f41c17a5cde59b4feba5e9f5c5e76f19559c787a7c771055 – SHORTING•PEACE – CommitmentNotFound
   * Invalid rune in a80edfcd247fc806702a8f4bb2a186416884a9aa15e2265b8d56299476b42a97 – MAGIC•INTERNET•MONEY – NameAlreadyTaken
   * Invalid rune in 422fdaae14b1471c9b5bf2a9397be1c8a3f73c85997894571b997a8256ffcaa1 – WALL•STREET•BETS – NameAlreadyTaken
   * Invalid rune in 4707b152fda64e0ad23b7101954147eb0147f6a21abe068c6ca0137f7a27bd7c – SATOSHI•NAKAMOTO – NameAlreadyTaken
   * Invalid rune in 347b3954f5f44053303c32966779d5f133262e293555809fb5bb760aabde5e3c – VALHALLACOINS – NameAlreadyTaken
   * Invalid rune in d9a2db44f537f7d8fc5d05150c738201aeca46092743cd7eeef67abc0aaafdaa – BITCOIN•DRAGON•RUNES – CommitmentNotFound
   * Invalid rune in 705c3ef1d3e8cd05fb38e04b1dcc4decc4d4600827d7207ada8d3a9b2a9c6553 – MAGIC•INTERNET•MONEY – NameAlreadyTaken
   * Invalid rune in 39eae3c2f33e810d33f1a9ae46a4ae3825cce57d2f9d12f4bba6b7b4dde73306 – CASEY•RODARMOR – NameAlreadyTaken
   * Invalid rune in cb2d3a1e10f2f8e80f0e968a3932709f1e0b2b374f3ce662dceff594ea8ea707 – SATOSHI•NAKAMOTO – NameAlreadyTaken
   * Invalid rune in d34fbab166e25e505e6abf36029b56f72aed4537db678d8de068d0873bd9b424 – LEGENDARY•GOODS – NameAlreadyTaken
   * Invalid rune in 643a55c76731df3d219a6959f7bc89a0ee55546434bc9244bdd9a92f8817763f – SATOSHI•NAKAMOTO – NameAlreadyTaken
   * Invalid rune in e2cc60f881e3f705b5353838708573d7f22acff5c807d8027854a9219c5b094d – RUNNING•BITCOIN – NameAlreadyTaken
   * Invalid rune in 5ab06362abf41f05f5b29dd4452a35876a5204e52180378ccdb1429a865d8a4f – MAGIC•INTERNET•MONEY – NameAlreadyTaken
   * Invalid rune in a8b1e8b8249da11bd036197211d80d32c0c3a3f86b8c48a552374ef562ee5d80 – HAVE•FUN•STAYING•POOR – NameAlreadyTaken
   * Invalid rune in cf8d0b08b752c30d60a9b57285b6d734ee4bdfb54a80eeffd1bf6f0c531c34df – WALL•STREET•BETS – NameAlreadyTaken
   * Invalid rune in efa0fac8c6b99e3011ff2af899c81274d66f0dbd4052f14d798cd8b33031e2ea – MAGIC•INTERNET•MONEY – NameAlreadyTaken
   * Invalid rune in 2731acb5417139f1e4157a91ebf13077dd50704f13291507636416d0727f36f2 – PISS•FETISHIST•DOUBLOONS – NameAlreadyTaken
   * Invalid rune in 009f4e52b5833ade631f8758329397b33475badaeaf2b3b180dc490ac26296c8 – CASEY•RODARMOR – NameAlreadyTaken
   * Invalid rune in 46dce3f09302123bd55dcee599dc3bd15bf8042ce4f3acfca23da604068d910b – MAGIC•INTERNET•MONEY – NameAlreadyTaken
   * Invalid rune in c49e0fb551c22aa8a9016a1f4fe1a354eb2136c67d2363f2f69b663a9760349e – HARRYPOTTEROBAMASONICINU – NameAlreadyTaken
   * Invalid rune in 1ca78a10982585e00f9897aa65684eb5c9ea3dc7b22b2da89a96afdc8333a4ad – SATOSHI•NAKAMOTO – NameAlreadyTaken
   * Invalid rune in 871bb415be82197f42e4d2247285a4c379c9e58ee782b762203909c33388677b – CASEY•RODARMOR – NameAlreadyTaken
   * Invalid rune in 0d00ef8bf16ade4988b1a74e58423327615250b89894a6c22bf876b2d61f3917 – GALACTIC•CREDIT – NameAlreadyTaken
   * Invalid rune in 5de90423d015fc76b368b50f4cb80e00ad9b64657b3ef5476882d9218291d62c – MICHAEL•SAYLOR – NameAlreadyTaken
   * Invalid rune in 1c17e5a7a8ce807a40b941c295385ee88f618a6eeaccd5f849a5ae84b9a318a2 – SATOSHI•NAKAMOTO – NameAlreadyTaken
   * Invalid rune in 4b7983ed864c6a60513d672d2ad433af3331f24866a2a8402733b9d7a7a49bec – BITCOIN•WIF•CAT – NameAlreadyTaken
   * Invalid rune in 22ee582f260d256cdbbfd2bdab95f75bf45b75b9819d53e7392881f0c9cd17db – SATOSHI•NAKAMOTO – NameAlreadyTaken
   * Invalid rune in 88deee231508e0a99da1f39ea74eb8e72dcbe056e8534dae632f4ee9199beb06 – THERE•IS•NO•SECOND•BEST – NameAlreadyTaken
   * Invalid rune in 4f40296ba03cc797646d32e416f8eeb53fe107e907c013bec617dd6daf726a4f – PEPE•IS•THE•MEME – NameAlreadyTaken
   * Invalid rune in 0df39d5ada0894f2bb338dd40e269c4dcc91eadef3064b86198667595cfe8712 – HARRY•POTTER•OBAMA•SONIC•INU – NameAlreadyTaken
   * Invalid rune in 1d4a587afd527a6e1bb4b1ef8015830ca6cee312313b5e415184a31626bec752 – RUNESTOTHEMOON – NameAlreadyTaken
   * Invalid rune in caa41578a1d4235283214bcdaf3b4517cc6186326c15f48e60162a2cf9674457 – LEGENDARY•GOODS – NameAlreadyTaken
   * Invalid rune in de5483fa2e36fa4194b194f71c0f3e1ef882aeaea8fdafdc2dfcf821d4f6bdb2 – WALL•STREET•BETS – NameAlreadyTaken
   * Invalid rune in b9fd944691b5dda51f43427ecefe2c0d2729bf6f9930e0b0166e17e52677730c – INTERGALACTIC – NameAlreadyTaken
   * Invalid rune in d7f15bda17b289b59873857d03a00bd3ca90bfa3ac9bcf27cd2030cf3f1b6519 – HOPE•YOU•GET•RICH – NameAlreadyTaken
   * Invalid rune in 208edfbfb3ff2044b8f5ad6dcf22f6a2ee3d8e187da90aafa3c73bcaa92ed1e0 – SATOSHI•NAKAMOTO – NameAlreadyTaken
   * Invalid rune in 935435d40ec3db29529a824eb308ca65a30209740ec71437cb97b8d3961e7417 – I•FOMO•WITH•DOMO•NO•HOMO – NameAlreadyTaken
   * Invalid rune in 73c8bb8a0aa4ba4d7e3b209fb4f29aa046f987f7cfaf61558f3e9617059ba721 – UNCOMMON•RUNES – NameAlreadyTaken
   * Invalid rune in 973284c3d70abbd76034b62c970004fec56440e0ea1bf6ca57223271cc5e3fbd – RUNETOTHEMOON – NameAlreadyTaken
   * Invalid rune in 46b41de5f341663ec1535286d96baa71c9255227b0f24dc096a071076025e5fc – THE•BIT•FOX•RUNE – NameAlreadyTaken
   * Invalid rune in a708366e661f08141579141adbb9e05023c569d0cc947f01dd20ea8132391c19 – JADE•AR•UTILITY – NameAlreadyTaken
   * Invalid rune in a5f4d9ce97684df03e4912e0f57df685e4164b0febb8e4d6d416c1137bee4212 – LETS•FUCKING•GO – NameAlreadyTaken
   * Invalid rune in 08c9fa4872b86e3595f40a35ba68428cd833b00fd490dbf2f9bc6be28818f9db – MAGIC•INTERNET•MONEY – NameAlreadyTaken
   * Invalid rune in db72fca94ff28e6c72919f6d266b4696cf240c901972ecb698ab7b5b59a28ecd – MAGIC•INTERNET•MONEY – NameAlreadyTaken
   * Invalid rune in 43fe09c6269b4b7ca71d397f1a8c3ccabf0d65242d69679ce147d84676f27726 – THERE•IS•NO•SECOND•BEST – NameAlreadyTaken
   * Invalid rune in 04dd595a920fc3f6a3f2c3f6d471b2b36a8ea6491073f75ad46b1ad01d6de053 – JADE•AR•PLATFORM – NameAlreadyTaken
   * Invalid rune in 867633aa43b6f7f11af383bffa8b075a83f53021e7fccf67cc24f247d5d85e95 – HARRYPOTTEROBAMASONICINU – NameAlreadyTaken
   * Invalid rune in 79bcaae96060ca205cd2789e414dee3b89201673f8ea0d4a454c89a067f6c3ec – RUNES•TO•THE•MOON – NameAlreadyTaken
   * Invalid rune in 1bb935fc353d586267b8648d9d324826f304e2dd78b3575c35048cb4334043fe – S•A•T•O•S•H•I•N•A•K•A•M•O•T•O – NameAlreadyTaken
   * Invalid rune in 143c8eb74afd43a1525e388dabcf5303e65256f44520063435163a4c818d1915 – WE•CALL•THEM•POOR – NameAlreadyTaken
   * Invalid rune in 7d17e49085f06c1e3b1bae458ba9afcd77363d101c574b2d77fde7ab29bbd82b – SATOSHI•NAKAMOTO – NameAlreadyTaken
   * Invalid rune in dd48e6b3b41f48e3d58f416f6ccd422888e9e6ebede67291d2e1b8f665ce93fd – NOT•FINANCIAL•ADVICE – NameAlreadyTaken
   * Invalid rune in 79e255eae68f688c497c058bbdcb450e9389aa5d1cf673f80f7ba533cb790e1f – SATOSHI•NAKAMOTO – NameAlreadyTaken
   * Invalid rune in e692d4d7311f58663eb2de6eb02e1b7deefd3d1cd4ed29b98748e9eabf21b8e8 – SATOSHI•NAKAMOTO – NameAlreadyTaken
   * Invalid rune in 00c2896d35bec83eb5467fcbda422e70b1f683b9d893711973128ae8900ba6ce – PEPE•ON•BITCOIN – NameAlreadyTaken
   * Invalid rune in 67491a9ad5f911aa038a3bfa8d9b9e9602806e1582c21a447891621ce0cb0482 – RUNNING•BITCOIN – NameAlreadyTaken
   */
  xit('SLOW: should identify all 66 invalid runestones of block 840000', async () => {

    var transactions = getBlock840000Txns();

    const allArtifacts: DigitalArtifact[] = [];
    for (const tx of transactions) {

      const artifacts: DigitalArtifact[] = DigitalArtifactsParserService.parse(tx);
      for (const artifact of artifacts) {
        allArtifacts.push(artifact);
      }
    }

    const expectedRunes = [
      'Z•Z•Z•Z•Z•FEHU•Z•Z•Z•Z•Z',
      'DECENTRALIZED',
      'DOG•GO•TO•THE•MOON',
      'THE•RUNIX•TOKEN',
      'DOG•DOG•DOG•DOG•DOG',
      'SATOSHI•NAKAMOTO',
      'MEME•ECONOMICS',
      'RSIC•GENESIS•RUNE',
      'LOBO•THE•WOLF•PUP',
      'THE•RUNE•HAMMER',
      'CAT•ON•SKATEBOARD',
      'SATFLOW•DOT•COM',
      'PUPS•WORLD•PEACE',
      'BULLISH•BITCOIN•PIZZA•NINJAS',
      'PIZZA•DELIVERY',
      'RARE•WIZARD•ORB',
      'MAGIC•INTERNET•MONEY',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      'COMMON•KIWI•SLICES',
      'GREED•FRAGMENTS',
      'RSIC•SEASON•TWO',
      'BITCOIN•WIF•HAT',
      'SHORT•THE•WORLD',
      'HODL•DIAMOND•DICK',
      'RUNEJESUS•ON•X•COM',
      'RARE•PUPPER•PASS',
      'PEPE•WIT•HONKERS',
      'KOALA•ON•IMPALA',
      'BUSH•DID•NINE•ELEVEN',
      'TAPROOT•WIZARDS',
      'TAPROOT•WIZARD',
      'THE•SIGMA•STONE',
      'BITCOIN•WIF•CAT',
      'WORLD•PEACE•MONEY',
      'DOPE•ASS•TICKER',
      'RUNE•FINANCIAL',
      'COOK•THE•MEMPOOL',
      'BUZZ•BUZZ•BUZZ•RUNE',
      'PANDAS•ON•RUNES',
      'DEGENERATE•SPAM',
      'RUNES•PROTOCOL',
      'PARTY•PARROT•DISCO•CLUB',
      'DOGGOPOTOMUSS',
      'CHONKY•FLOOFERS',
      'DOG•DOG•DOG•DOG•DOG•DOG',
      'DOG•DOG•DOG•DOG•DOG•DOG•DOG•DOG',
      'DOG•DOG•DOG•DOG•DOG•DOG•DOG',
      'LEGENDARY•RELICS',
      'AI•OWE•YOU•MONEY',
      'APE•SEASON•COIN',
      'LIGHTNING•CHARGE',
      'GAME•WORLD•COIN',
      'CODE•MONKEY•UNIT',
      'BANANA•REPUBLIC•CREDIT',
      'DEGENS•WIF•HATS',
      'AUSTRALIAN•SHEPHERD',
      'TIBETAN•MASTIFF',
      'KING•CHARLES•SPANIEL',
      'XOLOITZCUINTLI',
      'ENGLISH•SETTER',
      'SWEDISH•VALLHUND',
      'DOBERMAN•PINSCHER',
      'GOLDEN•RETRIEVER',
      'MINIATURE•SCHNAUZER',
      'PEMBROKE•WELSH•CORGI',
      'ITALIAN•GREYHOUND',
      'COCKER•SPANIEL',
      'AMERICAN•BULLDOG',
      'PORTUGUESE•WATER•DOG',
      'YORKSHIRE•TERRIER',
      'FRENCH•BULLDOG',
      'KOOIKERHONDJE',
      'DOGO•ARGENTINO',
      'JACK•RUSSELL•TERRIER',
      'GERMAN•SHEPHERD',
      'SIBERIAN•HUSKY',
      'LABRADOR•RETRIEVER',
      'OLD•ENGLISH•SHEEPDOG',
      'BERNESE•MOUNTAIN•DOG',
      'DOGUE•DE•BORDEAUX',
      'BITCOIN•DRUG•MONEY',
      'MAGISAT•DIAMONDS',
      'ARTIFICIAL•INTELLIGENCE',
      'ELF•ON•THE•SHELF',
      'ITS•TIME•TO•OIL•UP',
      'WALL•STREET•BETS',
      'SCHIZOPHRENIA',
      'BITCOIN•WORLD•ORDER',
      'PAY•ME•IN•BITCOIN',
      'ANSEM•SKY•DADDY',
      'RUNNING•BITCOIN',
      'PEPE•AND•BINGUS',
      'SHIBETOSHI•NAKAMOTO',
      'RUNE•FOR•EVERYONE',
      'PEPETOSHI•NAKAMOTO',
      'INTERGALACTIC',
      'TINY•RUNE•STONE',
      'CAI•YUAN•GUANG•JIN',
      'RUNECOIN•GENESIS•RUNE',
      'OINK•PIGGY•OINK',
      'RUNECOIN•SEASON•TWO',
      'SUPER•MARIO•COIN',
      'BTC•STARTUP•LAB',
      'TRASH•CAN•PANDA',
      'YOUONLYLIVEONCE',
      'UNCOMMON•ROCKS',
      'THE•FIRST•RUNES',
      'UNCOMMON•RUNES',
      'GENII•COIN•RUNE',
      'RUNES•X•BITCOIN',
      'GAME•OF•BITCOIN',
      'VALHALLACOINS',
      'LOOSE•MONETARY•POLICY',
      'XO•ALEXA•WAS•HERE',
      'DOPE•GRANDMA•COIN',
      'WE•ARE•GIGACHAD',
      'DEGENERATE•ORDINALS•GAMBLERS',
      'THE•FLINTSTONE',
      'DONT•BUY•ME•EVER',
      'NO•ORDINARY•KIND',
      'THE•OFFICIAL•BOZO',
      'THE•ORDZAAR•RUNES',
      'I•LOVE•TO•EAT•ASS',
      'SHIT•ON•BITCOIN',
      'UNITED•ARAB•EMIRATES',
      'GET•RICH•TOGETHER',
      'KEK•THE•GOD•OF•DARKNESS',
      'SHITCOIN•ON•BITCOIN',
      'WASA•WASA•MEME•COIN',
      'BITCOIN•CASEYNO',
      'ELON•LOVES•DOGE',
      'WORLD•PEACE•CAT',
      'YOU•MAY•ETCH•MY•ASS',
      'SPACES•ARE•COOL',
      'THE•DRUNKEN•PIRAT',
      'BUY•ATOM•ON•ATOMICALS',
      'WIZARD•FREEDOM',
      'YOLO•MOON•RUNES',
      'DOOOOOOOOOOOG',
      'MAGICAL•INTERNET•MONEY',
      'RUNE•ALPHA•COOK',
      'FEELING•GOOD•COIN',
      'HAVE•FUN•STAYING•POOR',
      'THERE•IS•NO•SECOND•BEST',
      'PEPE•AUTHENTIC',
      'RUENS•DOG•PIZZA',
      'ARK•BITCOIN•ETF',
      'FIGHT•INFLATION•ARMY•TOKEN',
      'SEC•COIN•BY•GARY•GENSLER',
      'BLESSTIGER•TRIDENT',
      'LASER•EYES•MAXI•INU',
      'METAVERSE•COIN',
      'INVISIBLE•HANDSHAKE',
      'DUST•SPIRAL•WANDER',
      'STAR•ECHO•WHISPER',
      'MEME•MINT•MILLION',
      'ATOMIC•SWAP•ARCADE',
      'GALACTIC•CREDIT',
      'GLOBAL•PAY•COIN',
      'ROBOT•AGENT•COIN',
      'MULTI•PASS•CREDIT',
      'RICH•SIMPLE•COIN',
      'FLY•ME•TO•THE•MOON',
      'INVISIBLE•TOUCH',
      'XXXXX•XXXXX•XXXXX',
      'TAPROOT•WIZORDS',
      'UNCOMMON•GOOSE',
      'DAO•GOVERN•COIN',
      'JUNGLE•JINGLE•JANGLE',
      'ZZZ•ZZZ•ZZZ•ZZZZ',
      'THE•DAO•GATE•COIN',
      'ROBO•RUBLE•RESERVE',
      'ORZ•ORZ•ORZ•ORZ•ORZ',
      'BOUNTY•HUNTDOG',
      'DIAMOND•BUBBLE',
      'COSMIC•CREDITS',
      'BOTCOIN•FLICKS',
      'AAAAA•AAA•AAAAA',
      'PEPE•BEBE•PENNY',
      'FRIENDS•WITH•BENEFITS',
      'BURNING•HOT•COIN',
      'DAO•THE•DAOEST•DAO',
      'DAO•ACCESS•COIN',
      'COLLATERAL•CLUB',
      'OOOOO•OOOOO•OOOOO',
      'PUMP•DUMP•PUNKS',
      'THE•DOGGY•SMELL',
      'LASER•EYE•TOKEN',
      'POOP•POOL•PARTY',
      'BUG•FEATURE•COIN',
      'SATOSHI•VISION',
      'YOU•BROUGHT•PISS•TO•A•SHIT•FIGHT',
      'MEME•ON•BITCOIN',
      'WESTERN•PAPERHANDS',
      'BITCOIN•IS•TOP•DOG',
      'NUMBER•GO•UP•HARD•CODED',
      'ELON•VS•ALEXANDRE',
      'BITFLOWERS•GIFT',
      'FORBIDDEN•FRUIT',
      'BITCOIN•CAT•RUNE',
      'ACORN•DEEZNUTS',
      'DEOXYRIBO•NUCLEIC•ACID',
      'KITTY•KITTY•MEOW•MEOW',
      'SATOSHIS•DIVINE•INTERVENTION',
      'WWW•BTC•BULLA•RUN',
      'HAPPY•BIRTHDAY',
      'TRICK•ORD•TREAT',
      'COUTNERFEIT•CULTURE',
      'NOT•YOUR•KEYS•NOT•YOUR•COINS',
      'CHOOSE•RICH•EVERYTIME',
      'DOPAMINE•FARMER',
      'BITMAP•LAND•XYZ',
      'THE•SHROOM•RUNE',
      'DONT•EAT•ME•LUKE',
      'PEPE•ONLY•FRENS',
      'BITCOIN•X•RUNES',
      'HOOOOOOOOTERS',
      'ERA•OF•THE•DRAGON',
      'ORDI•MOONSTONE',
      'BITCOIN•WIZARDS',
      'SPACEY•CODARMOR',
      'BTCS•BITCOIN•RUNES',
      'RUNES•SOUVENIR',
      'ALBERT•EINSTEIN',
      'BLAZEMAN•WIF•BLUNT',
      'MOTHERFUCKERS',
      'OP•RETURN•LOTTO',
      'SUPERSTELLAR•WORLD',
      'LONG•YOUR•LONGS',
      'REKT•MEMPOOL•ENJOYER',
      'LEGENDARY•GOODS',
      'CRYPTOCURRENCY',
      'RUNES•TO•THE•MOON',
      'MAGIC•MUSKRUNE',
      'ZEROES•TO•HEROES',
      'GUNSLINGERS•GOLD•DUST',
      'SWEET•DOGGO•RUNE',
      'RUNE•DROPPINGS',
      'ANSUZTHURISAZ',
      'THE•BOOK•OF•RUNES',
      'IMCUMMINGGOOD',
      'THE•TICKER•IS•ELSA',
      'FIRSTS•IS•FIRSTS',
      'COCK•OF•COCKS•COCK',
      'CASEY•RODARMOR',
      'RUNESTONE•DOGECOIN',
      'IIIIIIIIIIIII',
      'HARRY•POTTER•OBAMA•SONIC•INU',
      'ZZZZZZZZZZZZ',
      'COUNTERFEIT•CULTURE',
      'LEGENDARY•ORDS',
      'RODARMORWIFHAT',
      'RUNESTONE•WIZARDS',
      'RUNIC•TAPROOT•WIZARD',
      'RECYCLE•THE•CUM',
      'NON•STOP•NYAN•CAT',
      'SEND•ALIEN•NODES',
      'BITCOIN•ROBOTS',
      'MAGIC•SPELLCAST',
      'BITCOIN•ORDINALS•RUNEROCKS',
      'MEMPOOL•PUPPET',
      'QUANTUM•CAT•WIF•CAP',
      'SUNSHINE•PEPECOIN',
      'SPARKY•RUNEDOG',
      'BOND•JAMES•BOND',
      'ABBREVIATIONS',
      'ONIYOKAI•GOODS',
      'KNIGHTS•TEMPLAR',
      'BITCOIN•DICK•BUTT',
      'PISS•FETISHIST•DOUBLOONS',
      'RUNE•COIN•MASTER',
      'ONE•DOLLAR•COIN',
      'THE•WIZARD•OF•OZ',
      'RUNEFLEX•TOKEN',
      'MOBY•DICK•WHALE',
      'RUNESCAPE•GOLD',
      'THE•CHEF•OF•RUNE',
      'UGLY•GIRLS•LOVE•MONEY•TOO',
      'BREAD•AND•BUTTA',
      'HELP•ME•HELP•YOU',
      'BLUE•HORSESHOE•LOVES•BITCOIN',
      'GOBBLE•GOBBLE•GOBBLE',
      'PEPE•PEPE•RUNES',
      'MEMES•AND•GAMES',
      'ORDZ•GAMES•MOON',
      'OTTO•RUINED•HERE',
      'RUNE•PEPE•TOKEN',
      'IMOK•ARE•YOU•OKAY',
      'RUINS•BY•INSCRIBE',
      'SHIBA•INU•RUNES',
      'OW•RUNED•REKTUM',
      'DICK•BUTT•RUNES',
      'MICHAEL•SAYLOR',
      'THE•DONALD•TRUMP',
      'FUCKGARYGINSLER',
      'RUNE•PUNKS•ON•BTC',
      'RSIC•METAPROTOCOL',
      'GHOSTFACE•KILLAH',
      'PEDRO•THE•RACOON',
      'BTC•BULLS•BUCKOS',
      'DIAMONDHANDZZ',
      'NEDERLANDSE•GULDEN',
      'TEST•DO•NOT•MINT',
      'WE•ALL•GONNA•MAKE•IT',
      'YOU•SELL•YOU•GAY',
      'BIG•LIZARD•ENERGY',
      'MONEYPRINTERGOBRRR',
      'DERPY•PLOPPERS',
      'BITCOINHALVING',
      'PROBABLY•NOTHING',
      'RUNES•ROCKS•BTC',
      'FUCK•THE•POLICE',
      'VITALIK•BUTERIN',
      'ROCKTOSHI•IS•A•CHODE',
      'SAYLORBTCMOON',
      'ORDINALS•ARE•DEAD',
      'ORD•RUNE•DEGEN•GAME',
      'FIRST•MEMECOIN•ON•RUNES',
      'BITCOIN•ON•RUNES',
      'SHITCOIN•BOZOS',
      'BITCOIN•PUPPETS',
      'ETERNAL•RUNE•COIN',
      'LOVE•DEATH•ROBOTS',
      'RUNESTONE•BTCR',
      'WOW•DOTSWAP•WOW',
      'WHITE•ROBE•WZRD',
      'MYSTIC•RUNE•COIN',
      'PICO•POWER•BOTTOM',
      'HARRY•POTTER•OBAMA•SONIC•IO•INU',
      'VIVA•LASOGETTE',
      'AI•PUPPETS•ROBOTS',
      'HOOKERS•N•COCAINE',
      'QUANTUM•CATS•RUNE',
      'NEVER•GONNA•GIVE•YOU•UP',
      'OH•DADDY•RUNE•ME',
      'FORTHECULTURE',
      'LETS•FUCKING•GO',
      'CRUSADESTUDIO',
      'NO•GOD•PLEASE•NO',
      'HONK•HONK•HONK•HONK',
      'PEPE•IS•THE•MEME',
      'ORD•GAME•OF•RUNES',
      'READY•PLAYER•ONE',
      'BITBOY•GENESIS',
      'DOGE•RUNESTONE',
      'MERLIN•ZERO•RUNE',
      'RUNEOXBTOXBTBTC',
      'SATOSHINOMICS',
      'CONSTELLATION',
      'MOON•BITCOIN•RUNES',
      'BTCS•RUNES•TOKEN',
      'THE•ZERO•DOLLAR',
      'DONT•GET•FROGGY',
      'MEOW•MEOW•MEOW•MEOW•MEOW',
      'THE•NAME•OF•YOUR•TICK',
      'MOON•RUNES•TOKEN',
      'UNCOMMON•BOOBS',
      'ELON•NAKAMUSKO',
      'MONG•MONG•MONG•MONG',
      'RUNES•TO•DA•MOON',
      'THE•POODLE•PENNIES',
      'ORDINALS•RUNES',
      'PAPI•CHULO•COIN',
      'HARRYPOTTEROBAMASONIC',
      'FIRST•SKULL•RUNE',
      'THE•HALVING•RUNE',
      'NODE•NODE•NODES',
      'FINNEY•FINNEY•FINNEY',
      'SATOSHI•IS•BACK',
      'FIRST•RUNE•BLOCK',
      'TAP•RUNE•WIZARD',
      'CRYPTOSOPHISM',
      'BITCOIN•SHEKEL',
      'REAL•WORLD•ASSETS',
      'AI•PUPS•DOGE•PEPE',
      'WWW•DOTSWAP•APP',
      'KEY•TO•VALHALLA',
      'NOUNISH•PUPPIES',
      'B•TRACKER•COIN•B',
      'REAL•WORLD•ASSET',
      'DEPRESSED•CITIZENS',
      'NATCONIC•ICONS',
      'SUPERCALIFRAGILISTIC',
      'NUMBER•GO•UP•TECHNOLOGY',
      'LIONLIONLION•IO',
      'I•FOMO•WITH•DOMO•NO•HOMO',
      'THE•INFERNO•BTC',
      'ONE•RUNE•BITCOIN',
      'FBI•WARNING•DAO',
      'YO•ALPHA•ALPHONSO',
      'POWA•RANGERS•GO',
      'BITCOIN•MONKEY',
      'GAY•MUSLIM•PARTY•BUS•FOUR',
      'A•CLASSIC•PUMP•AND•DUMP',
      'PAYMENT•PIXELS',
      'CRYSTALS•OF•TIME',
      'THE•FIRST•PAGES',
      'GAY•MUSLIM•PARTY•BUS•TWO',
      'GERIATRIC•POISON',
      'ETHEREUM•SUCKS',
      'TRANSCENDENTS',
      'PUSSY•MONEY•WEED',
      'MOONS•OVER•MY•HAMMY',
      'ALLIGATOR•SPERM',
      'RUNEE•THE•WORLD',
      'BITCOIN•METAVERSE',
      'PLEASE•MINT•MY•RUNE',
      'SUCH•HEAVY•BAGS',
      'TOENAIL•CLIPPINGS',
      'RUNE•GIGACHADS',
      'ULTRA•RARE•GOODS',
      'POOP•POOP•POOP•POOP',
      'DONALD•TRUMP•MAGA',
      'U•WOT•BRO•MATE•FAM',
      'USA•USA•USA•USA•USA',
      'EMPTY•PROMISES',
      'UNCUTTIES•BTFO',
      'RARE•RUNEY•GOLD',
      'BONE•SHARD•BOBUX',
      'NO•LONGER•A•PET•ROCK•BITCH',
      'NANANANANANANANA•BATMAN',
      'IMPENDING•DOOM',
      'LEGENDARY•LOOT',
      'EXTREMELY•UNCOMMON•GOODS',
      'JIMINY•CRICKETS',
      'ANCIENT•OG•RUNE',
      'FRAGMENTATION',
      'THE•SINGULARITY',
      'PRESIDENT•BIDEN',
      'FINITE•ELEMENTS',
      'HOPE•YOU•GET•RICH',
      'VIRGINITY•POINTS',
      'EXTRAORDINARY',
      'COPE•SEETHE•MALD',
      'CAT•CAT•CAT•CAT•CAT',
      'BITCOIN•CURRENCY',
      'IN•THE•BEGINNING',
      'UNCONVENTIONAL',
      'RUNE•DREAM•LAND',
      'PURPLE•MAGIC•BEANS',
      'RUNE•MAFIA•COIN',
      'COLLECTIBLE•STAMPS',
      'DIGITALIZATION',
      'PEDRO•THE•RACCOON',
      'TRILLION•DOLLAR•MEME',
      'MEMEPOOL•DOT•SPADES',
      'DEEDEE•GENESIS',
      'A•VERY•NICE•RUNE',
      'FREEDOM•MONIES',
      'GAY•MUSLIM•PARTY•BUS•EIGHT',
      'I•LOVE•JUSTIN•SUN',
      'DIGITAL•ENERGY',
      'DEEP•LEARN•RUNE',
      'PRESIDENT•TRUMP',
      'TRANSCENDENCE',
      'RECURSIVE•LOGIC',
      'REEEEEEEEEEEE',
      'UNALIGNED•ATOMS',
      'MICROSTRATEGY',
      'DOPE•STREET•CRED',
      'GAY•MUSLIM•PARTY•BUS•THREE',
      'STOOPID•TURTLEZ',
      'FAAAAAAAAAAART',
      'LOOK•MOM•I•MADE•IT',
      'CRUMBS•FROM•GOD',
      'DIMINISHING•RETURNS',
      'OOMPA•LOOMPA•MONEY',
      'FRACTAL•SHARDS',
      'UNITED•STATES•DOLLAR',
      'MILLIONAIRES•CLUB',
      'ODINSWAP•RUNES',
      'NEVER•NOT•MAXIS',
      'LIL•DADDY•YUM•YUMS',
      'ENTERTAINMENT',
      'VEILED•DEITIES',
      'GAY•MUSLIM•PARTY•BUS•FIVE',
      'YOU•ARE•WHAT•YOU•MEME',
      'DUMBLEDORES•SECRET',
      'RUNES•COLLECTIVE',
      'GLEEB•WIF•GLOOB',
      'TRILLIONAIRES',
      'NOTHING•IS•IMPOSSIBLE',
      'I•MADE•A•RUNE•LOL',
      'ZERO•ONE•TWO•THREE',
      'GANGSTER•POINTS',
      'MYBITCOINKINGDOM•LAND•TOKEN',
      'NEW•SHINY•THING',
      'HARRYS•NIGHTMARE',
      'DIGITAL•PATTERNS',
      'BEAT•BLOCK•BOYS',
      'SHIBONK•DOGELON•WIF•PEPEAI•INU',
      'GAY•MUSLIM•PARTY•BUS',
      'PROOF•OF•WEAK•HANDS',
      'THE•BIT•FOX•RUNE',
      'ENDLESSFORGE•IO',
      'HANGRY•KITTIES',
      'BABYS•FIRST•RUNE',
      'THE•LOST•RELICS',
      'GAY•MUSLIM•PARTY•BUS•SIX',
      'JEETS•PARADISE',
      'BITCOIN•MAXI•CLUB',
      'GAY•MUSLIM•PARTY•BUS•SEVEN',
      'TINY•PARTICLES',
      'TWENTY•ONE•MILLION',
      'THREE•COMMA•CLUB',
      'STONES•OF•PANGEA',
      'SATOSHIS•TREASURE',
      'NEURAL•MIND•MINT',
      'YEAH•THATS•GOOD',
      'MODI•NAHI•TOH•KAUN',
      'RUNE•RUNE•RUNE•RUNE',
      'BANANA•GAME•COIN',
      'MAGIC•MEMPOOL•MONEY',
      'THE•FIRST•DOG•RUNE',
      'COMIC•CAPITALS',
      'GOLDEN•RUNE•GEMS',
      'RUNE•TO•THE•MOON',
      'ALIEN•INVASION',
      'GENESIS•X•RUNES',
      'CATBUS•CATBUS•CATBUS',
      'SHOTA•RUSTAVELI',
      'BITCOIN•ALPHA•MAXI',
      'LONG•LIVE•THE•BERA•MARKET',
      'BACK•TO•THE•FUTURE',
      'OM•BHUR•BHUVAH•SWAH',
      'UNCOMMON•PONZI',
      'INTERJEKTIO•OY',
      'WAGMI•WITH•THIS',
      'FEAR•IS•THE•MIND•KILLER',
      'ANARCHO•CATBUS',
      'SATS•CAPITALIST',
      'LIFE•WORTH•LIVING',
      'JADE•JD•PLATFORM',
      'PEPES•OFF•RUNES',
      'JADE•AR•UTILITY',
      'AMANAPLANACANALPANAMA',
      'QUARTER•POUNDER',
      'PESOSARGENTINOS',
      'JADE•AR•PLATFORM',
      'ORDVISION•LABS•RUNE',
      'KISS•YOUR•HOMIES•GOODNIGHT',
      'MEERKATS•GO•BRRR',
      'GOODBOYPOINTS',
      'FOUR•LEAF•CLOVER',
      'UNCOMMON•GOODS•ARE•NOT•RARE',
      'UNCOMMOMGOODS',
      'YOLO•TRADE•ZONE',
      'BLOCKBUSTER•VIDEO',
      'MOUNTAINTOP•KINGS',
      'ELLIPTIC•CURVE',
      'BIRDZ•WIF•BREAD',
      'PINEAPPLE•PIZZA',
      'SNED•IT•BY•FIAT•MAFIA',
      'POODLE•PENNIES',
      'STOCK•TO•FLOW•MODEL',
      'RUNE•ORD•SATOSHI',
      'AWESOME•TOKENS',
      'A•PEER•TO•PEER•E•CASH•SYSTEM',
      'YOU•ME•THEM•US•LOVE',
      'JADE•JD•ARDINALS',
      'AUTISTIC•GOODS',
      'IN•WE•TRUST•FOREVER',
      'INFINITY•KITTY',
      'WE•LIKE•THE•COIN',
      'FOLOW•ME•ON•X•BOHDANDJA',
      'JAPONAISERIES',
      'TRUE•OG•RUNE•MINT',
      'FREEDOM•OF•SPEECH',
      'TEN•THOUSAND•RUNES',
      'PANTUFA•FLYERS',
      'MOON•BEAM•COINS',
      'THEBITCOCAINE',
      'MANGO•WITH•TAJIN',
      'EXQUISITE•CAVIAR',
      'CHILAQUILES•DE•LA•ABUELA',
      'FRESH•HOT•LATKES',
      'CHICKEN•NUGGET',
      'MAMAS•MEATBALLS',
      'DELICIOUS•CARROTS',
      'BLACK•TAR•HEROIN',
      'GRILLED•CHEESE',
      'DIMETHYLTRYPTAMINE',
      'MAGIC•MUSHROOMS',
      'LYSERGIC•ACID•DIETHYLAMIDE',
      'TETRAHYDROCANNABINOL',
      'KING•SALMON•NIGIRI',
      'RIPE•WATERMELON',
      'MODI•DICTATORSHIP',
      'ROBO•AI•DOGINALS',
      'JADE•JD•ARDINAL',
      'BITCOIN•IS•KING',
      'BITCOIN•IS•DEAD',
      'RUNES•RUNES•RUNES',
      'CAT•IN•A•DOGS•WORLD',
      'ELON•DOGE•SPACEX',
      'THIS•IS•GENTLEMEN',
      'WORLD•WAR•THREE',
      'HELP•ME•DEBUG•THIS',
      'CASEYRODAMOR•RUNE',
      'GENESIS•RUNETOSHI',
      'GO•FUCK•YOURSELF',
      'WHAT•IS•GOING•ON',
      'WWW•CANONIC•XYZ',
      'WE•CALL•THEM•POOR',
      'LOVE•ONE•ANOTHER',
      'ORDINAL•DEGENS',
      'THIS•IS•NOT•A•SECURITY',
      'HUMAN•FRATERNITY',
      'WORLD•PEACE•NOW',
      'HALVING•RUNE•ONE',
      'THE•SUMMER•RUNE',
      'REVOLUTIONARY',
      'BUY•BTC•FUCK•THE•FED',
      'MAWEAAISTHEBEST',
      'RUNESDAORUNES',
      'PYRAMID•SCHEME',
      'BITCOIN•HALVED',
      'BITCOINEPICSHIT',
      'BUN•BUN•LEFUZZZ',
      'JPEG•ANARCHISTS',
      'SATOSHIS•RUNES',
      'SEND•THIS•TO•MOON',
      'CASEYSMOMWIFHAT',
      'SATSHUNTERS•RUNES',
      'RUNE•SESTERTIUS',
      'THERUNESARECOMING',
      'MAGIC•INTRENT•MONEY',
      'RUNES•CATWIFHAT',
      'WE•LIKE•THE•RUNE',
      'NOT•FINANCIAL•ADVICE',
      'FINANCIAL•ADVICE',
      'WENLAMBOWIFHAT',
      'PEPE•ON•BITCOIN',
      'THERUNETOMOON',
      'RUNE•MOON•SOON•BOON',
      'DOGWIFBEER•RUNES',
      'HANGNAM•STYLE•RUNE',
      'A•WHOLE•BITCOIN',
      'FUDS•IS•THE•FUEL',
      'FREEDOM•TO•TRANSACT',
      'CANTHEDEVSDOSOMETHING',
      'ORDINALS•FOREVER',
      'GRANTSCHNEIDER',
      'BITCOIN•NAME•SYSTEM',
      'ONLY•GOD•FORGIVES',
      'TRIPPLETITTIES',
      'RUNE•IS•AWESOME',
      'MICHI•KITTYCAT',
      'FRANKZAPPATRIBUTE',
      'RUNES•ON•BITCOIN',
      'BUSINESSMANETHSUCKS',
      'ORDZAAR•FOREVER',
      'RUNES•MOONS•SOON',
      'EIGHT•FORTY•STANDARD',
      'MICHEALJACKSON',
      'ETHEREUM•WAS•THE•TESTNET',
      'EAT•SLEEP•TUSHY',
      'RUNES•FRENCHIE',
      'RUNESTONEMOON',
      'PEPE•PUP•DOG•LOVE',
      'THE•RUNE•HUNTERS',
      'TAYLOR•SWIFTLY',
      'RUIFINMERLINS',
      'BRETHGYKROOMONETEN',
      'CREDO•UNUM•DEUM',
      'GARY•GENSLER•COIN',
      'SOCIAL•NETWORK•HEART',
      'FREE•IS•ALWAYS•FAIR',
      'TWO•DICKS•THREE•DIMENSIONS',
      'RUNE•ZERO•CRYPTO',
      'W•THREE•A•CRYPTO',
      'DIAMOND•HANDS•ONLY',
      'DUMBGAYRETARD',
      'SATOSHIS•UNSPENDABLE•BITCOIN',
      'BOBS•AND•VAGENE',
      'RUNESTONE•PUPS',
      'THE•HALVING•RUNES',
      'TEACH•ME•HOW•TO•DOG',
      'ORANGE•DOLLARS',
      'BITCOIN•BY•SATOSHI',
      'WAM•RUNES•ON•BTC',
      'RANDOMIZATION',
      'RUNIC•SUBSTANCE',
      'Y•Y•Y•Y•Y•Y•Y•Y•Y•Y•Y•Y•Y',
      'RUNES•MADE•MAMA•PROUD',
      'CREEPZ•TAKEOVER•RUNE',
      'ONCHAINMONKEY',
      'FOUR•TWENTY•SIXTY•NINE',
      'THE•BEST•RUNEBEST',
    ];

    const runestones = allArtifacts.filter(x => x.type === DigitalArtifactType.Runestone) as ParsedRunestone[];

    const validRunestones: ParsedRunestone[] = [];
    const invalidRunestones: { reason: string, runestone: ParsedRunestone }[] = [];

    let validRunestoneCounter = 0;
    for (const runestone of runestones) {

      if (!runestone?.runestone?.etching) {
        continue;
      }

      const runeName = runestone?.runestone?.etching.runeName!;
      const myTxn = transactions.find(x => x.txid === runestone.transactionId)!;
      const vinTxns: IEsploraApi.Transaction[] = [];

      for (let i = 0; i < myTxn.vin.length; i++) {
        const vin = myTxn.vin[i];

        // wait to not hit rate limits
        await new Promise(resolve => setTimeout(resolve, 50));

        // console.log('Fetching vin.txid')
        const response = await axios.get(`https://mempool.space/api/tx/${vin.txid}`);
        const transaction = response.data as IEsploraApi.Transaction;
        vinTxns.push(transaction);
      }

      const validationResult = RuneParserService.validateRune(myTxn, vinTxns, Network.MAINNET, runeName);

      if (validationResult) {
        invalidRunestones.push({ reason: validationResult, runestone });
        log(`Invalid rune in ${myTxn.txid} – ${runeName} – ${validationResult}`);
        continue;
      }

      const nameAlreadyTaken = validRunestones.find(x => removeSpacers(x.runestone?.etching?.runeName || '') === removeSpacers(runeName));
      if (nameAlreadyTaken) {
        invalidRunestones.push({ reason: 'NameAlreadyTaken', runestone });
        log(`Invalid rune in ${myTxn.txid} – ${runeName} – NameAlreadyTaken`);
        continue;
      }

      if (expectedRunes[validRunestoneCounter] !== runeName) {
        log(`Unexpected Rune in ${myTxn.txid} – ${runeName}`);
      }

      validRunestones.push(runestone);
      validRunestoneCounter++;
    }

    log("Amount of invalid runestones: " + invalidRunestones.length);

    // we finally made it! we have the same numbers as org
    // 755 - 66 == 689 🎉🎉
    expect(755 - invalidRunestones.length).toBe(689)

  }, 30 * 60 * 1000);
});
