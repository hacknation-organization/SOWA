-- Initial schema generated from app/models (SQLModel), Postgres dialect.
-- RLS is enabled without policies: the backend connects as the postgres role (bypasses RLS),
-- while the Supabase Data API (anon/authenticated keys) gets no access to these tables.

CREATE TABLE "user" (
	id SERIAL NOT NULL, 
	username VARCHAR NOT NULL, 
	password_hash VARCHAR NOT NULL, 
	role VARCHAR NOT NULL, 
	display_name VARCHAR NOT NULL, 
	unit VARCHAR, 
	PRIMARY KEY (id)
);
CREATE UNIQUE INDEX ix_user_username ON "user" (username);
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;

CREATE TABLE employee (
	id SERIAL NOT NULL, 
	first_name VARCHAR NOT NULL, 
	last_name VARCHAR NOT NULL, 
	position VARCHAR NOT NULL, 
	unit VARCHAR NOT NULL, 
	manager_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(manager_id) REFERENCES "user" (id)
);
CREATE INDEX ix_employee_manager_id ON employee (manager_id);
ALTER TABLE employee ENABLE ROW LEVEL SECURITY;

CREATE TABLE process (
	id SERIAL NOT NULL, 
	employee_id INTEGER NOT NULL, 
	manager_id INTEGER NOT NULL, 
	type VARCHAR NOT NULL, 
	form VARCHAR, 
	stage VARCHAR NOT NULL, 
	status VARCHAR NOT NULL, 
	period_start DATE, 
	period_end DATE, 
	deadline DATE, 
	job_description VARCHAR, 
	interview_date DATE, 
	interview_notes VARCHAR, 
	development_plan VARCHAR, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(employee_id) REFERENCES employee (id), 
	FOREIGN KEY(manager_id) REFERENCES "user" (id)
);
CREATE INDEX ix_process_manager_id ON process (manager_id);
CREATE INDEX ix_process_employee_id ON process (employee_id);
ALTER TABLE process ENABLE ROW LEVEL SECURITY;

CREATE TABLE decision (
	id SERIAL NOT NULL, 
	process_id INTEGER NOT NULL, 
	competency_id VARCHAR NOT NULL, 
	level INTEGER NOT NULL, 
	suggested_level INTEGER, 
	justification VARCHAR, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (process_id, competency_id), 
	FOREIGN KEY(process_id) REFERENCES process (id)
);
CREATE INDEX ix_decision_process_id ON decision (process_id);
ALTER TABLE decision ENABLE ROW LEVEL SECURITY;

CREATE TABLE processcompetency (
	id SERIAL NOT NULL, 
	process_id INTEGER NOT NULL, 
	competency_id VARCHAR NOT NULL, 
	position INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (process_id, competency_id), 
	FOREIGN KEY(process_id) REFERENCES process (id)
);
CREATE INDEX ix_processcompetency_process_id ON processcompetency (process_id);
ALTER TABLE processcompetency ENABLE ROW LEVEL SECURITY;

CREATE TABLE rating (
	id SERIAL NOT NULL, 
	process_id INTEGER NOT NULL, 
	competency_id VARCHAR NOT NULL, 
	indicator_id VARCHAR NOT NULL, 
	level INTEGER, 
	example VARCHAR, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (process_id, indicator_id), 
	FOREIGN KEY(process_id) REFERENCES process (id)
);
CREATE INDEX ix_rating_process_id ON rating (process_id);
ALTER TABLE rating ENABLE ROW LEVEL SECURITY;

CREATE TABLE reminder (
	id SERIAL NOT NULL, 
	process_id INTEGER NOT NULL, 
	sent_by INTEGER NOT NULL, 
	recipient_id INTEGER NOT NULL, 
	message VARCHAR NOT NULL, 
	channel VARCHAR NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(process_id) REFERENCES process (id), 
	FOREIGN KEY(sent_by) REFERENCES "user" (id), 
	FOREIGN KEY(recipient_id) REFERENCES "user" (id)
);
CREATE INDEX ix_reminder_process_id ON reminder (process_id);
ALTER TABLE reminder ENABLE ROW LEVEL SECURITY;

-- Extra indexes on foreign keys not indexed by the models (Supabase advisor: unindexed_foreign_keys).
CREATE INDEX ix_reminder_sent_by ON reminder (sent_by);
CREATE INDEX ix_reminder_recipient_id ON reminder (recipient_id);
