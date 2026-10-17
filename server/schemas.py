from marshmallow import RAISE, Schema, fields, pre_load, validate

STATUSES = ("scheduled", "completed", "cancelled")
MAX_PRICE = 99999999.99


def strip_fields(data, keys):
    if not isinstance(data, dict):
        return data
    cleaned = dict(data)
    for key in keys:
        value = cleaned.get(key)
        if isinstance(value, str):
            cleaned[key] = value.strip()
    return cleaned


class StrictSchema(Schema):
    """Reject unknown fields such as user_id, and strip the strings named in strip_keys."""

    class Meta:
        unknown = RAISE

    strip_keys = ()

    @pre_load
    def strip_strings(self, data, **kwargs):
        return strip_fields(data, self.strip_keys)


class JobSchema(StrictSchema):
    strip_keys = ("service_type", "notes")

    id = fields.Int(dump_only=True)
    date = fields.Date(required=True)
    time = fields.Time(required=True)
    service_type = fields.Str(required=True, validate=validate.Length(min=1))
    status = fields.Str(validate=validate.OneOf(STATUSES))
    price = fields.Float(required=True, validate=validate.Range(min=0, max=MAX_PRICE))
    paid = fields.Bool()
    notes = fields.Str(allow_none=True)
    client_id = fields.Int(required=True)
    client_name = fields.Function(
        lambda obj: obj.client.name if getattr(obj, "client", None) else None,
        dump_only=True,
    )
    client_address = fields.Function(
        lambda obj: obj.client.address if getattr(obj, "client", None) else None,
        dump_only=True,
    )
    user_id = fields.Int(dump_only=True)


class ClientSchema(StrictSchema):
    strip_keys = ("name", "address", "phone", "notes")

    id = fields.Int(dump_only=True)
    name = fields.Str(required=True, validate=validate.Length(min=1))
    address = fields.Str(allow_none=True)
    phone = fields.Str(allow_none=True)
    notes = fields.Str(allow_none=True)
    user_id = fields.Int(dump_only=True)
    jobs = fields.Nested(JobSchema, many=True, dump_only=True)


class SignupSchema(StrictSchema):
    strip_keys = ("username", "email")

    username = fields.Str(required=True, validate=validate.Length(min=1))
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=8), load_only=True)

    @pre_load
    def strip_strings(self, data, **kwargs):
        data = strip_fields(data, self.strip_keys)
        if isinstance(data, dict) and isinstance(data.get("email"), str):
            data["email"] = data["email"].lower()
        return data


class LoginSchema(StrictSchema):
    strip_keys = ("username",)

    username = fields.Str(required=True)
    password = fields.Str(required=True, load_only=True)


class UserSchema(Schema):
    id = fields.Int(dump_only=True)
    username = fields.Str()
    email = fields.Email()
