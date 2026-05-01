# Modelo de datos inicial

## users

- id
- name
- username
- email
- password_hash
- temporary_password_required
- role_id
- area_id
- position
- is_active
- last_login_at
- is_protected
- created_at

## roles

- id
- name
- permissions

Roles iniciales:

- admin: registra unidades, usuarios, credenciales y parametros.
- ventanilla: registra recibidas, despachadas y archivo digital.
- funcionario: revisa y gestiona documentos de su unidad.
- supervisor: consulta seguimiento y reportes.

## areas

- id
- name
- parent_area_id
- is_active

## documents

- id
- tenant_id
- direction
- year
- type_id
- code
- internal_number
- reference
- subject
- sender_name
- receiver_name
- source_unit_id
- target_unit_id
- current_unit_id
- created_by_unit_id
- received_by_reception
- current_area_id
- current_owner_id
- requester_position
- priority
- status
- due_date
- is_response
- is_external
- has_digital_file
- digital_file_name
- digital_file_size
- digital_attached_at
- physical_received
- created_by
- created_at
- updated_at

Regla: `current_unit_id` define que unidad puede ver y operar el documento. Un documento entrante debe iniciar con `current_unit_id` igual a Recepcion/Ventanilla y solo cambia cuando se registra una derivacion.

## document_files

- id
- document_id
- file_name
- storage_path
- mime_type
- uploaded_by
- created_at

## movements

- id
- document_id
- from_area_id
- to_area_id
- from_user_id
- to_user_id
- from_unit_id
- to_unit_id
- status
- comment
- instruction_type
- derived_at
- due_days
- created_by
- created_at

## document_types

- id
- name
- direction
- is_active

## counters

- id
- tenant_id
- direction
- year
- current_number

## audit_logs

- id
- tenant_id
- user_id
- entity
- entity_id
- action
- payload
- created_at
