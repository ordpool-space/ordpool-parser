// TODO: These interfaces are currently unused. Replace the inline BRC-20 types
// in ordpool-stats.ts (Brc20DeployAttempt etc.) and the analyser service with
// these cleaner definitions where applicable.
import { DigitalArtifact } from "./digital-artifact";

export enum Network {
  Mainnet = 'mainnet',
  Fractal = 'fractal',
}

export type BrC20Operation = 'deploy' | 'mint' | 'transfer';

export interface BrC20Deploy {
  p: 'brc-20';
  op: 'deploy';
  tick: string; // always lowercase
  max: string;
  lim: string;
  dec: string; // max 18
}

export interface BrC20Mint {
  p: 'brc-20';
  op: 'mint';
  tick: string; // always lowercase
  amt: string;
}

export interface BrC20Transfer {
  p: 'brc-20';
  op: 'transfer';
  tick: string; // always lowercase
  amt: string;
}

export type BrC20Parsed = BrC20Deploy | BrC20Mint | BrC20Transfer;
