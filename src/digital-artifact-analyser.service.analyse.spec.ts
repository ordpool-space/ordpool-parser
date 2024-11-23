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
    const flags = await DigitalArtifactAnalyserService.analyse(cat21Artifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_cat21 |
      OrdpoolTransactionFlags.ordpool_cat21_mint
    );
  });

  it('should return correct flags for Atomical', async () => {
    const atomicalArtifact = { type: DigitalArtifactType.Atomical } as any;
    const flags = await DigitalArtifactAnalyserService.analyse(atomicalArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_atomical
    );
  });

  it('should return correct flags for Inscription with BRC-20 deploy', async () => {
    const inscriptionArtifact = {
      type: DigitalArtifactType.Inscription,
      contentType: 'application/json',
      getContent: () => Promise.resolve(JSON.stringify({ p: 'brc-20', op: 'deploy' })),
    } as ParsedInscription;
    const flags = await DigitalArtifactAnalyserService.analyse(inscriptionArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_inscription |
      OrdpoolTransactionFlags.ordpool_inscription_mint |
      OrdpoolTransactionFlags.ordpool_brc20 |
      OrdpoolTransactionFlags.ordpool_brc20_deploy
    );
  });

  it('should return correct flags for Inscription with BRC-20 mint', async () => {
    const inscriptionArtifact = {
      type: DigitalArtifactType.Inscription,
      contentType: 'application/json',
      getContent: () => Promise.resolve(JSON.stringify({ p: 'brc-20', op: 'mint' })),
    } as ParsedInscription;
    const flags = await DigitalArtifactAnalyserService.analyse(inscriptionArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_inscription |
      OrdpoolTransactionFlags.ordpool_inscription_mint |
      OrdpoolTransactionFlags.ordpool_brc20 |
      OrdpoolTransactionFlags.ordpool_brc20_mint
    );
  });

  it('should return correct flags for Inscription with BRC-20 transfer', async () => {
    const inscriptionArtifact = {
      type: DigitalArtifactType.Inscription,
      contentType: 'application/json',
      getContent: () => Promise.resolve(JSON.stringify({ p: 'brc-20', op: 'transfer' })),
    } as ParsedInscription;
    const flags = await DigitalArtifactAnalyserService.analyse(inscriptionArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_inscription |
      OrdpoolTransactionFlags.ordpool_inscription_mint |
      OrdpoolTransactionFlags.ordpool_brc20 |
      OrdpoolTransactionFlags.ordpool_brc20_transfer
    );
  });

  it('should return correct flags for Inscription with unsupported JSON content', async () => {
    const inscriptionArtifact = {
      type: DigitalArtifactType.Inscription,
      contentType: 'application/json',
      getContent: () => Promise.resolve(JSON.stringify({ p: 'unsupported', op: 'deploy' })),
    } as ParsedInscription;
    const flags = await DigitalArtifactAnalyserService.analyse(inscriptionArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_inscription |
      OrdpoolTransactionFlags.ordpool_inscription_mint
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
    const flags = await DigitalArtifactAnalyserService.analyse(runestoneArtifact);
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
    const flags = await DigitalArtifactAnalyserService.analyse(runestoneArtifact);
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
    const flags = await DigitalArtifactAnalyserService.analyse(cenotaphArtifact);
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
    const flags = await DigitalArtifactAnalyserService.analyse(cenotaphArtifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_rune |
      OrdpoolTransactionFlags.ordpool_rune_cenotaph
    );
  });

  it('should return correct flags for SRC-20 with deploy', async () => {
    const src20Artifact = {
      type: DigitalArtifactType.Src20,
      getContent: () => JSON.stringify({ p: 'src-20', op: 'deploy' }),
    } as ParsedSrc20;
    const flags = await DigitalArtifactAnalyserService.analyse(src20Artifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_src20 |
      OrdpoolTransactionFlags.ordpool_src20_deploy
    );
  });

  it('should return correct flags for SRC-20 with mint', async () => {
    const src20Artifact = {
      type: DigitalArtifactType.Src20,
      getContent: () => JSON.stringify({ p: 'src-20', op: 'mint' }),
    } as ParsedSrc20;
    const flags = await DigitalArtifactAnalyserService.analyse(src20Artifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_src20 |
      OrdpoolTransactionFlags.ordpool_src20_mint
    );
  });

  it('should return correct flags for SRC-20 with transfer', async () => {
    const src20Artifact = {
      type: DigitalArtifactType.Src20,
      getContent: () => JSON.stringify({ p: 'src-20', op: 'transfer' }),
    } as ParsedSrc20;
    const flags = await DigitalArtifactAnalyserService.analyse(src20Artifact);
    expect(flags).toBe(
      OrdpoolTransactionFlags.ordpool_src20 |
      OrdpoolTransactionFlags.ordpool_src20_transfer
    );
  });

  it('should return correct flags for unsupported SRC-20 JSON content', async () => {
    const src20Artifact = {
      type: DigitalArtifactType.Src20,
      getContent: () => JSON.stringify({ p: 'unsupported', op: 'transfer' }),
    } as ParsedSrc20;
    const flags = await DigitalArtifactAnalyserService.analyse(src20Artifact);
    expect(flags).toBe(OrdpoolTransactionFlags.ordpool_src20);
  });
});
