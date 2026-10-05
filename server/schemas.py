from marshmallow import RAISE, Schema, fields, validate

STATUSES = ("scheduled", "completed", "cancelled")


class JobSchema(Schema):
    id = fields.Int(dump_only=True)
    date = fields.Date(required=True)
    time = fields.Time(required=True)
    service_type = fields.Str(required=True, validate=validate.Length(min=1))
    status = fields.Str(validate=validate.OneOf(STATUSES))
    price = fields.Float(required=True, validate=validate.Range(min=0))
    paid = fields.Bool()
    notes = fields.Str(allow_none=True)
    client_id = fields.Int(required=True)
    user_id = fields.Int(dump_only=True)

    class Meta:
        unknown = RAISE


class ClientSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True, validate=validate.Length(min=1))
    address = fields.Str(allow_none=True)
    phone = fields.Str(allow_none=True)
    notes = fields.Str(allow_none=True)
    user_id = fields.Int(dump_only=True)
    jobs = fields.Nested(JobSchema, many=True, dump_only=True)

    class Meta:
        unknown = RAISE


class SignupSchema(Schema):
    username = fields.Str(required=True, validate=validate.Length(min=1))
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=1), load_only=True)

    class Meta:
        unknown = RAISE


class LoginSchema(Schema):
    username = fields.Str(required=True)
    password = fields.Str(required=True, load_only=True)

    class Meta:
        unknown = RAISE


class UserSchema(Schema):
    id = fields.Int(dump_only=True)
    username = fields.Str()
    email = fields.Email()
