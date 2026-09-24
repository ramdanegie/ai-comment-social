export class Result<T, E = string> {
  private constructor(
    public readonly isSuccess: boolean,
    public readonly error?: E,
    private readonly _value?: T
  ) {}

  public get value(): T {
    if (!this.isSuccess) {
      throw new Error(`Cannot get value from failed result: ${this.error}`);
    }
    return this._value as T;
  }

  public static ok<U>(value: U): Result<U, never> {
    return new Result<U, never>(true, undefined, value);
  }

  public static err<L>(error: L): Result<never, L> {
    return new Result<never, L>(false, error);
  }
}
