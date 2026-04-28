import { DigitalArtifactAnalyserService } from "./digital-artifact-analyser.service";
import { DigitalArtifactType } from "./types/digital-artifact";
import { OrdpoolTransactionFlags } from "./types/ordpool-transaction-flags";
import { ParsedCat21 } from "./types/parsed-cat21";
import { ParsedInscription } from "./types/parsed-inscription";
import { ParsedRunestone } from "./types/parsed-runestone";
import { ParsedSrc20 } from "./types/parsed-src20";


describe('DigitalArtifactAnalyserService.analyse', () => {

  it('should return correct flags for Cat21', async () => {
    const cat21Artifact = { type: DigitalArtifactType.Cat21 } as ParsedCat21;
    const { flags } = await DigitalArtifactAnalyserService.analyse(cat21Artifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_cat21 |
      OrdpoolTransactionFlags.ordpool_cat21_mint
    );
  });

  it('should return correct flags for Atomical', async () => {
    const atomicalArtifact = { type: DigitalArtifactType.Atomical } as any;
    const { flags } = await DigitalArtifactAnalyserService.analyse(atomicalArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_atomical
    );
  });

  it('should return correct flags for Labitbu', async () => {
    const labitbuArtifact = { type: DigitalArtifactType.Labitbu } as any;
    const { flags } = await DigitalArtifactAnalyserService.analyse(labitbuArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_labitbu
    );
  });

  it('should return correct flags for Inscription with valid BRC-20 deploy', async () => {
    const inscriptionArtifact = {
      type: DigitalArtifactType.Inscription,
      contentType: 'application/json',
      getContent: () => Promise.resolve(JSON.stringify({ p: 'brc-20', op: 'deploy', tick: 'ordi', max: '21000000' })),
    } as ParsedInscription;
    const { flags } = await DigitalArtifactAnalyserService.analyse(inscriptionArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_inscription |
      OrdpoolTransactionFlags.ordpool_inscription_mint |
      OrdpoolTransactionFlags.ordpool_inscription_json |
      OrdpoolTransactionFlags.ordpool_brc20 |
      OrdpoolTransactionFlags.ordpool_brc20_deploy
    );
  });

  it('should return correct flags for Inscription with valid BRC-20 mint', async () => {
    const inscriptionArtifact = {
      type: DigitalArtifactType.Inscription,
      contentType: 'application/json',
      getContent: () => Promise.resolve(JSON.stringify({ p: 'brc-20', op: 'mint', tick: 'ordi', amt: '1000' })),
    } as ParsedInscription;
    const { flags } = await DigitalArtifactAnalyserService.analyse(inscriptionArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_inscription |
      OrdpoolTransactionFlags.ordpool_inscription_mint |
      OrdpoolTransactionFlags.ordpool_inscription_json |
      OrdpoolTransactionFlags.ordpool_brc20 |
      OrdpoolTransactionFlags.ordpool_brc20_mint
    );
  });

  it('should return correct flags for Inscription with valid BRC-20 transfer', async () => {
    const inscriptionArtifact = {
      type: DigitalArtifactType.Inscription,
      contentType: 'application/json',
      getContent: () => Promise.resolve(JSON.stringify({ p: 'brc-20', op: 'transfer', tick: 'ordi', amt: '500' })),
    } as ParsedInscription;
    const { flags } = await DigitalArtifactAnalyserService.analyse(inscriptionArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_inscription |
      OrdpoolTransactionFlags.ordpool_inscription_mint |
      OrdpoolTransactionFlags.ordpool_inscription_json |
      OrdpoolTransactionFlags.ordpool_brc20 |
      OrdpoolTransactionFlags.ordpool_brc20_transfer
    );
  });

  // -- Invalid BRC-20: operation flags are skipped, only top-level brc20 flag is set --

  it('should skip deploy flag for BRC-20 with missing ticker (the block 790,148 bug)', async () => {
    const inscriptionArtifact = {
      type: DigitalArtifactType.Inscription,
      contentType: 'application/json',
      getContent: () => Promise.resolve(JSON.stringify({ p: 'brc-20', op: 'deploy', max: '1000' })),
    } as ParsedInscription;
    const { flags } = await DigitalArtifactAnalyserService.analyse(inscriptionArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_inscription |
      OrdpoolTransactionFlags.ordpool_inscription_mint |
      OrdpoolTransactionFlags.ordpool_inscription_json |
      OrdpoolTransactionFlags.ordpool_brc20
      // NO ordpool_brc20_deploy -- invalid BRC-20 is silently skipped
    );
  });

  it('should skip mint flag for BRC-20 with missing ticker and amount', async () => {
    const inscriptionArtifact = {
      type: DigitalArtifactType.Inscription,
      contentType: 'application/json',
      getContent: () => Promise.resolve(JSON.stringify({ p: 'brc-20', op: 'mint' })),
    } as ParsedInscription;
    const { flags } = await DigitalArtifactAnalyserService.analyse(inscriptionArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_inscription |
      OrdpoolTransactionFlags.ordpool_inscription_mint |
      OrdpoolTransactionFlags.ordpool_inscription_json |
      OrdpoolTransactionFlags.ordpool_brc20
      // NO ordpool_brc20_mint -- invalid BRC-20 is silently skipped
    );
  });

  it('should skip transfer flag for BRC-20 with missing amount', async () => {
    const inscriptionArtifact = {
      type: DigitalArtifactType.Inscription,
      contentType: 'application/json',
      getContent: () => Promise.resolve(JSON.stringify({ p: 'brc-20', op: 'transfer', tick: 'ordi' })),
    } as ParsedInscription;
    const { flags } = await DigitalArtifactAnalyserService.analyse(inscriptionArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_inscription |
      OrdpoolTransactionFlags.ordpool_inscription_mint |
      OrdpoolTransactionFlags.ordpool_inscription_json |
      OrdpoolTransactionFlags.ordpool_brc20
      // NO ordpool_brc20_transfer -- missing amt
    );
  });

  it('should return correct flags for Inscription with unsupported JSON content', async () => {
    const inscriptionArtifact = {
      type: DigitalArtifactType.Inscription,
      contentType: 'application/json',
      getContent: () => Promise.resolve(JSON.stringify({ p: 'unsupported', op: 'deploy' })),
    } as ParsedInscription;
    const { flags } = await DigitalArtifactAnalyserService.analyse(inscriptionArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_inscription |
      OrdpoolTransactionFlags.ordpool_inscription_mint |
      OrdpoolTransactionFlags.ordpool_inscription_json
    );
  });

  it('should return correct flags for Runestone with etching', async () => {
    const runestoneArtifact = {
      type: DigitalArtifactType.Runestone,
      runestone: {
        etching: {
          // content is not analysed here
        }
      },
    } as ParsedRunestone;
    const { flags } = await DigitalArtifactAnalyserService.analyse(runestoneArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_rune |
      OrdpoolTransactionFlags.ordpool_rune_etch
    );
  });

  it('should return correct flags for Runestone with mint', async () => {
    const runestoneArtifact = {
      type: DigitalArtifactType.Runestone,
      runestone: {
        mint: {
          // content is not analysed here
        }
      },
    } as ParsedRunestone;
    const { flags } = await DigitalArtifactAnalyserService.analyse(runestoneArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_rune |
      OrdpoolTransactionFlags.ordpool_rune_mint
    );
  });

  it('should return correct flags for invalid Runestone (Cenotaph) with etching', async () => {
    const cenotaphArtifact = {
      type: DigitalArtifactType.Runestone,
      cenotaph: {
        etching: {
          // content is not analysed here
        }
      },
    } as ParsedRunestone;
    const { flags } = await DigitalArtifactAnalyserService.analyse(cenotaphArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_rune |
      OrdpoolTransactionFlags.ordpool_rune_cenotaph
    );
  });

  it('should return correct flags for invalid Runestone (Cenotaph) with mint', async () => {
    const cenotaphArtifact = {
      type: DigitalArtifactType.Runestone,
      cenotaph: {
        mint: {
          // content is not analysed here
        }
      },
    } as ParsedRunestone;
    const { flags } = await DigitalArtifactAnalyserService.analyse(cenotaphArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_rune |
      OrdpoolTransactionFlags.ordpool_rune_cenotaph
    );
  });

  it('should return correct flags for valid SRC-20 deploy', async () => {
    const src20Artifact = {
      type: DigitalArtifactType.Src20,
      getContent: () => JSON.stringify({ p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000', lim: '100' }),
    } as ParsedSrc20;
    const { flags } = await DigitalArtifactAnalyserService.analyse(src20Artifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_src20 |
      OrdpoolTransactionFlags.ordpool_src20_deploy
    );
  });

  it('should return correct flags for valid SRC-20 mint', async () => {
    const src20Artifact = {
      type: DigitalArtifactType.Src20,
      getContent: () => JSON.stringify({ p: 'src-20', op: 'mint', tick: 'STAMP', amt: '100' }),
    } as ParsedSrc20;
    const { flags } = await DigitalArtifactAnalyserService.analyse(src20Artifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_src20 |
      OrdpoolTransactionFlags.ordpool_src20_mint
    );
  });

  it('should return correct flags for valid SRC-20 transfer', async () => {
    const src20Artifact = {
      type: DigitalArtifactType.Src20,
      getContent: () => JSON.stringify({ p: 'src-20', op: 'transfer', tick: 'STAMP', amt: '50' }),
    } as ParsedSrc20;
    const { flags } = await DigitalArtifactAnalyserService.analyse(src20Artifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_src20 |
      OrdpoolTransactionFlags.ordpool_src20_transfer
    );
  });

  it('should ignore unsupported SRC-20 JSON content (`p` must always be `src-20`)', async () => {
    const src20Artifact = {
      type: DigitalArtifactType.Src20,
      getContent: () => JSON.stringify({ p: 'unsupported', op: 'transfer' }),
    } as ParsedSrc20;
    const { flags } = await DigitalArtifactAnalyserService.analyse(src20Artifact);
    expect(flags).toBe(0n);
  });

  // -- Invalid SRC-20: operation flags are skipped, only top-level src20 flag is set --

  it('should skip deploy flag for SRC-20 with missing ticker', async () => {
    const src20Artifact = {
      type: DigitalArtifactType.Src20,
      getContent: () => JSON.stringify({ p: 'src-20', op: 'deploy', max: '21000', lim: '100' }),
    } as ParsedSrc20;
    const { flags } = await DigitalArtifactAnalyserService.analyse(src20Artifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_src20
      // NO ordpool_src20_deploy -- invalid SRC-20 is silently skipped
    );
  });

  it('should skip deploy flag for SRC-20 with missing lim (required for SRC-20)', async () => {
    const src20Artifact = {
      type: DigitalArtifactType.Src20,
      getContent: () => JSON.stringify({ p: 'src-20', op: 'deploy', tick: 'STAMP', max: '21000' }),
    } as ParsedSrc20;
    const { flags } = await DigitalArtifactAnalyserService.analyse(src20Artifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_src20
      // NO ordpool_src20_deploy -- missing lim
    );
  });

  it('should skip mint flag for SRC-20 with missing amount', async () => {
    const src20Artifact = {
      type: DigitalArtifactType.Src20,
      getContent: () => JSON.stringify({ p: 'src-20', op: 'mint', tick: 'STAMP' }),
    } as ParsedSrc20;
    const { flags } = await DigitalArtifactAnalyserService.analyse(src20Artifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_src20
      // NO ordpool_src20_mint -- missing amt
    );
  });
});
