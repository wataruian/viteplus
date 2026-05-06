class BaseModel {
  createdAt: Date;
  id: string;
  updatedAt: Date;

  constructor(id: string) {
    this.id = id;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  static fromJson(json: Record<string, unknown>): BaseModel {
    const model = new BaseModel(json['id'] as string);
    model.createdAt = new Date(json['createdAt'] as string);
    model.updatedAt = new Date(json['updatedAt'] as string);
    return model;
  }

  static fromString(str: string): BaseModel {
    const json = JSON.parse(str);
    return BaseModel.fromJson(json);
  }

  static getModelName(): string {
    return BaseModel.name;
  }

  toJson(): Record<string, unknown> {
    return {
      createdAt: this.createdAt.toISOString(),
      id: this.id,
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  toString(): string {
    return JSON.stringify(this.toJson());
  }

  update(): void {
    this.updatedAt = new Date();
  }
}

export default BaseModel;
