import { map } from "./mooncat-parser.helper";

describe('map', () => {
  it('should map a number in the range', () => {
    const res = map(5, 0, 10, 0, 100);
    expect (res).toEqual(50);
  });

  it('should map a number outside the range', () => {
    const res = map(50, 0, 10, 0, 100);
    expect (res).toEqual(500);
  });

  it('should map floats', () => {
    const res = map(0.555, 0, 1, 0, 100);
    expect (res).toBeCloseTo(55.5);
  });

  it('should map negative numbers', () => {
    const res = map(-20, -100, 100, 0, 1);
    expect (res).toBeCloseTo(0.4);
  });
});
