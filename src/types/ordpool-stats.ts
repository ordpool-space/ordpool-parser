export interface OrdpoolStats {
  amount: {
    atomical: number | null;
    atomicalMint: number | null;
    atomicalTransfer: number | null;
    atomcialUpdate: number | null;

    cat21: number | null;
    cat21Mint: number | null;
    cat21Transfer: number | null;

    inscription: number | null;
    inscriptionMint: number | null;
    inscriptionTransfer: number | null;
    inscriptionBurn: number | null;

    rune: number | null;
    runeEtch: number | null;
    runeTransfer: number | null;
    runeBurn: number | null;

    brc20: number | null;
    brc20Deploy: number | null;
    brc20Mint: number | null;
    brc20Transfer: number | null;

    src20: number | null;
    src20Deploy: number | null;
    src20Mint: number | null;
    src20Transfer: number | null;
  }
}

// this empty object represents no parsed data
export function getEmptyStats(): OrdpoolStats {

  return {
    amount: {
      atomical: null,
      atomicalMint: null,
      atomicalTransfer: null,
      atomcialUpdate: null,

      cat21: null,
      cat21Mint: null,
      cat21Transfer: null,

      inscription: null,
      inscriptionMint: null,
      inscriptionTransfer: null,
      inscriptionBurn: null,

      rune: null,
      runeEtch: null,
      runeTransfer: null,
      runeBurn: null,

      brc20: null,
      brc20Deploy: null,
      brc20Mint: null,
      brc20Transfer: null,

      src20: null,
      src20Deploy: null,
      src20Mint: null,
      src20Transfer: null,
    }
  };
}
