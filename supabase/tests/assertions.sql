-- Execute after bootstrap + migration with psql -v ON_ERROR_STOP=1.
begin;
insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003'),('00000000-0000-0000-0000-000000000004');
insert into portal.profiles(id,admin) select id,id='00000000-0000-0000-0000-000000000004'::uuid from auth.users;
insert into portal.businesses values ('10000000-0000-0000-0000-000000000001','A'),('10000000-0000-0000-0000-000000000002','B');
insert into portal.memberships values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','owner',true),('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','member',true),('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','owner',true);
insert into portal.projects values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','A'),('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','B');
insert into portal.project_grants values ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',true),('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',true),('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',true);
insert into portal.milestones values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',2,'awaiting'),('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',1,'awaiting');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$begin
if (select count(*) from portal.projects) <> 1 then raise exception 'tenant isolation failed'; end if;
begin insert into portal.projects values('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','forged'); raise exception 'client insert allowed'; exception when insufficient_privilege then null; end;
begin perform portal.approve_milestone('30000000-0000-0000-0000-000000000002',1,'40000000-0000-0000-0000-000000000001'); raise exception 'cross tenant approve allowed'; exception when insufficient_privilege then null; end;
begin perform portal.approve_milestone('30000000-0000-0000-0000-000000000001',1,'40000000-0000-0000-0000-000000000001'); raise exception 'stale approve allowed'; exception when invalid_parameter_value then null; end;
perform portal.approve_milestone('30000000-0000-0000-0000-000000000001',2,'40000000-0000-0000-0000-000000000001');
perform portal.approve_milestone('30000000-0000-0000-0000-000000000001',2,'40000000-0000-0000-0000-000000000001');
begin perform portal.approve_milestone('30000000-0000-0000-0000-000000000001',3,'40000000-0000-0000-0000-000000000001'); raise exception 'payload reuse allowed'; exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
do $$begin
begin perform portal.approve_milestone('30000000-0000-0000-0000-000000000001',2,'40000000-0000-0000-0000-000000000002'); raise exception 'member approve allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
do $$begin
if (select count(*) from portal.projects) <> 2 then raise exception 'admin view failed'; end if;
begin perform portal.approve_milestone('30000000-0000-0000-0000-000000000001',2,'40000000-0000-0000-0000-000000000002'); raise exception 'admin client approve allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$begin
if exists(select 1 from portal.projects) then raise exception 'null identity view'; end if;
begin perform portal.approve_milestone('30000000-0000-0000-0000-000000000001',2,'40000000-0000-0000-0000-000000000002'); raise exception 'null identity approve'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update portal.project_grants set active=false where actor_id='00000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$begin
if exists(select 1 from portal.projects) or exists(select 1 from portal.receipts) then raise exception 'revoked grant read'; end if;
begin perform portal.approve_milestone('30000000-0000-0000-0000-000000000001',2,'40000000-0000-0000-0000-000000000001'); raise exception 'revoked grant retry'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update portal.project_grants set active=true where actor_id='00000000-0000-0000-0000-000000000001';
update portal.memberships set active=false where actor_id='00000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$begin
if exists(select 1 from portal.projects) then raise exception 'revoked member view'; end if;
if exists(select 1 from portal.receipts) then raise exception 'revoked receipt view'; end if;
begin perform portal.approve_milestone('30000000-0000-0000-0000-000000000001',2,'40000000-0000-0000-0000-000000000001'); raise exception 'revoked retry allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update portal.profiles set active=false where id='00000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
do $$begin
if exists(select 1 from portal.profiles) or exists(select 1 from portal.projects) then raise exception 'inactive identity read'; end if;
begin perform portal.approve_milestone('30000000-0000-0000-0000-000000000001',2,'40000000-0000-0000-0000-000000000002'); raise exception 'inactive identity rpc'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$begin
begin perform * from portal.projects; raise exception 'anon read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$declare relation text; privilege text; begin
foreach relation in array array['profiles','businesses','memberships','projects','project_grants','milestones','approvals','receipts','outbox'] loop
foreach privilege in array array['INSERT','UPDATE','DELETE','TRUNCATE'] loop
if has_table_privilege('authenticated','portal.' || relation,privilege) or has_table_privilege('anon','portal.' || relation,privilege) then raise exception 'untrusted mutation privilege: % %',relation,privilege; end if;
end loop;
end loop;
if has_function_privilege('anon','portal.approve_milestone(uuid,integer,uuid)','EXECUTE') then raise exception 'anon rpc privilege'; end if;
end $$;
do $$begin
if (select count(*) from portal.approvals) <> 1 or (select count(*) from portal.receipts) <> 1 or (select count(*) from portal.outbox) <> 1 then raise exception 'atomic durable counts failed'; end if;
end $$;
rollback;
