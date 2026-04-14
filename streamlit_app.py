"""GTD — a Streamlit app that operationalizes David Allen's Getting Things Done.

Tabs (mobile-friendly):
    📥 Capture      Quick-add anything into the inbox.
    🔍 Clarify      Process inbox items one at a time.
    ✅ Next          Filter next actions by context.
    📁 Projects     Manage projects and their next actions.
    ⏳ Waiting      Track delegated items.
    💭 Someday      Someday/Maybe + Reference shelf.
    🔄 Review       Guided Weekly Review checklist.
"""
from __future__ import annotations

from datetime import date

import streamlit as st

from gtd import db

st.set_page_config(page_title="GTD", page_icon="✅", layout="centered")

db.get_conn()  # initialize schema on first run


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _context_picker(label: str = "Context", key: str | None = None):
    contexts = db.list_contexts()
    options = {c["name"]: c["id"] for c in contexts}
    options = {"(none)": None, **options}
    chosen = st.selectbox(label, list(options.keys()), key=key)
    return options[chosen]


def _project_picker(label: str = "Project", key: str | None = None):
    projects = db.list_projects(status="active")
    options = {p["title"]: p["id"] for p in projects}
    options = {"(none)": None, **options}
    chosen = st.selectbox(label, list(options.keys()), key=key)
    return options[chosen]


def _due_input(key: str):
    use_due = st.checkbox("Has a due date", key=f"{key}_use")
    if use_due:
        d = st.date_input("Due", value=date.today(), key=f"{key}_date")
        return d.isoformat()
    return None


# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------

st.title("✅ GTD")
st.caption("Capture, clarify, organize, reflect, engage.")

inbox_n = db.inbox_count()
next_n = len(db.list_actions(status="next"))
waiting_n = len(db.list_actions(status="waiting"))
active_projects = len(db.list_projects(status="active"))

m1, m2, m3, m4 = st.columns(4)
m1.metric("Inbox", inbox_n)
m2.metric("Next", next_n)
m3.metric("Waiting", waiting_n)
m4.metric("Projects", active_projects)

tabs = st.tabs(
    ["📥 Capture", "🔍 Clarify", "✅ Next", "📁 Projects", "⏳ Waiting", "💭 Someday", "🔄 Review"]
)


# ---------------------------------------------------------------------------
# 📥 Capture
# ---------------------------------------------------------------------------
with tabs[0]:
    st.subheader("Capture")
    st.write("Dump anything on your mind. No judgment, no filtering.")
    with st.form("capture_form", clear_on_submit=True):
        text = st.text_area("What's on your mind?", height=100, label_visibility="collapsed")
        submitted = st.form_submit_button("Capture", use_container_width=True)
        if submitted:
            if text.strip():
                # Support multi-line bulk capture: one item per non-empty line.
                lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
                for ln in lines:
                    db.add_inbox_item(ln)
                st.success(f"Captured {len(lines)} item(s).")
                st.rerun()
            else:
                st.warning("Nothing to capture.")

    items = db.list_inbox()
    if items:
        st.divider()
        st.caption(f"Inbox ({len(items)}) — process these in the Clarify tab.")
        for it in items[-10:][::-1]:
            st.write(f"• {it['raw_text']}")


# ---------------------------------------------------------------------------
# 🔍 Clarify
# ---------------------------------------------------------------------------
with tabs[1]:
    st.subheader("Clarify")
    items = db.list_inbox()
    if not items:
        st.success("Inbox zero. 🎉")
    else:
        item = items[0]
        st.info(f"**{item['raw_text']}**")
        st.caption(f"{len(items)} item(s) left • captured {item['created_at']}")

        choice = st.radio(
            "What is it?",
            [
                "Actionable — Next action",
                "Actionable — 2-minute rule (do it now)",
                "Actionable — Waiting for someone",
                "Actionable — New project",
                "Not actionable — Someday/Maybe",
                "Not actionable — Reference",
                "Trash",
            ],
            key=f"clarify_choice_{item['id']}",
        )

        with st.form(f"clarify_form_{item['id']}", clear_on_submit=False):
            title = st.text_input("Title", value=item["raw_text"])
            notes = st.text_area("Notes", value="", height=80)

            context_id = None
            project_id = None
            delegated_to = None
            due_iso = None

            if choice.startswith("Actionable — Next action"):
                context_id = _context_picker(key=f"ctx_{item['id']}")
                project_id = _project_picker(key=f"proj_{item['id']}")
                due_iso = _due_input(key=f"due_{item['id']}")
            elif choice.startswith("Actionable — Waiting"):
                delegated_to = st.text_input("Delegated to")
                project_id = _project_picker(key=f"proj_wait_{item['id']}")
                due_iso = _due_input(key=f"due_wait_{item['id']}")
            elif choice.startswith("Actionable — New project"):
                outcome = st.text_input("Successful outcome looks like…")
                first_action = st.text_input("First next action")
                context_id = _context_picker(label="Context for first action", key=f"ctx_new_{item['id']}")

            submit = st.form_submit_button("Process", use_container_width=True)
            if submit:
                try:
                    if choice == "Actionable — Next action":
                        db.add_action(title, notes, "next", context_id, project_id, None, due_iso)
                    elif choice == "Actionable — 2-minute rule (do it now)":
                        db.add_action(title, notes, "done")
                    elif choice == "Actionable — Waiting for someone":
                        db.add_action(title, notes, "waiting", None, project_id, delegated_to, due_iso)
                    elif choice == "Actionable — New project":
                        pid = db.add_project(title, outcome=outcome)
                        if first_action.strip():
                            db.add_action(first_action, "", "next", context_id, pid)
                    elif choice == "Not actionable — Someday/Maybe":
                        db.add_action(title, notes, "someday")
                    elif choice == "Not actionable — Reference":
                        db.add_reference(title, notes)
                    # Trash: just delete the inbox item.
                    db.delete_inbox_item(item["id"])
                    st.rerun()
                except ValueError as e:
                    st.error(str(e))

        if st.button("Skip for now", key=f"skip_{item['id']}"):
            # Rotate: delete + re-add so it goes to the end.
            db.delete_inbox_item(item["id"])
            db.add_inbox_item(item["raw_text"])
            st.rerun()


# ---------------------------------------------------------------------------
# ✅ Next Actions
# ---------------------------------------------------------------------------
with tabs[2]:
    st.subheader("Next Actions")

    contexts = db.list_contexts()
    ctx_options = {"All contexts": None, **{c["name"]: c["id"] for c in contexts}}
    chosen = st.selectbox("Filter by context", list(ctx_options.keys()))
    ctx_id = ctx_options[chosen]

    actions = db.list_actions(status="next", context_id=ctx_id)
    if not actions:
        st.info("No next actions here. Capture something or run Clarify.")
    for a in actions:
        cols = st.columns([0.08, 0.72, 0.2])
        with cols[0]:
            if st.checkbox("", key=f"done_{a['id']}"):
                db.complete_action(a["id"])
                st.rerun()
        with cols[1]:
            label = a["title"]
            meta = []
            if a["context_name"]:
                meta.append(a["context_name"])
            if a["project_title"]:
                meta.append(f"📁 {a['project_title']}")
            if a["due_date"]:
                meta.append(f"⏰ {a['due_date']}")
            st.write(label)
            if meta:
                st.caption(" • ".join(meta))
            if a["notes"]:
                st.caption(a["notes"])
        with cols[2]:
            if st.button("Delete", key=f"del_{a['id']}"):
                db.delete_action(a["id"])
                st.rerun()

    with st.expander("➕ Add next action directly"):
        with st.form("add_action_form", clear_on_submit=True):
            t = st.text_input("Title")
            n = st.text_area("Notes", height=60)
            cid = _context_picker(key="add_ctx")
            pid = _project_picker(key="add_proj")
            due = _due_input(key="add_due")
            if st.form_submit_button("Add"):
                try:
                    db.add_action(t, n, "next", cid, pid, None, due)
                    st.rerun()
                except ValueError as e:
                    st.error(str(e))


# ---------------------------------------------------------------------------
# 📁 Projects
# ---------------------------------------------------------------------------
with tabs[3]:
    st.subheader("Projects")

    with st.expander("➕ New project"):
        with st.form("new_project", clear_on_submit=True):
            pt = st.text_input("Title")
            po = st.text_area("Outcome (what does done look like?)", height=60)
            if st.form_submit_button("Create"):
                try:
                    db.add_project(pt, po)
                    st.rerun()
                except ValueError as e:
                    st.error(str(e))

    projects = db.list_projects(status="active")
    if not projects:
        st.info("No active projects.")
    for p in projects:
        with st.expander(f"📁 {p['title']}"):
            if p["outcome"]:
                st.caption(p["outcome"])
            p_actions = db.list_actions(status=None, project_id=p["id"])
            next_actions = [a for a in p_actions if a["status"] == "next"]
            if not next_actions:
                st.warning("⚠️ No next action defined for this project.")
            for a in p_actions:
                icon = {"next": "➡️", "waiting": "⏳", "done": "✅", "someday": "💭"}.get(a["status"], "•")
                st.write(f"{icon} {a['title']}  ")
                if a["status"] != "done":
                    c1, c2 = st.columns(2)
                    if c1.button("Mark done", key=f"pdone_{a['id']}"):
                        db.complete_action(a["id"])
                        st.rerun()
                    if c2.button("Delete", key=f"pdel_{a['id']}"):
                        db.delete_action(a["id"])
                        st.rerun()

            with st.form(f"add_to_proj_{p['id']}", clear_on_submit=True):
                new_title = st.text_input("Add next action", key=f"nt_{p['id']}")
                new_ctx = _context_picker(key=f"nc_{p['id']}")
                if st.form_submit_button("Add action"):
                    try:
                        db.add_action(new_title, "", "next", new_ctx, p["id"])
                        st.rerun()
                    except ValueError as e:
                        st.error(str(e))

            c1, c2 = st.columns(2)
            if c1.button("Mark project complete", key=f"pcomplete_{p['id']}"):
                db.set_project_status(p["id"], "complete")
                st.rerun()
            if c2.button("Move to someday", key=f"psomeday_{p['id']}"):
                db.set_project_status(p["id"], "someday")
                st.rerun()


# ---------------------------------------------------------------------------
# ⏳ Waiting For
# ---------------------------------------------------------------------------
with tabs[4]:
    st.subheader("Waiting For")
    waiting = db.list_actions(status="waiting")
    if not waiting:
        st.info("Nothing waiting on anyone.")
    for a in waiting:
        cols = st.columns([0.8, 0.2])
        with cols[0]:
            st.write(f"⏳ **{a['title']}**")
            meta = []
            if a["delegated_to"]:
                meta.append(f"→ {a['delegated_to']}")
            if a["due_date"]:
                meta.append(f"follow-up {a['due_date']}")
            if a["project_title"]:
                meta.append(f"📁 {a['project_title']}")
            if meta:
                st.caption(" • ".join(meta))
        with cols[1]:
            if st.button("Received", key=f"recv_{a['id']}"):
                db.complete_action(a["id"])
                st.rerun()


# ---------------------------------------------------------------------------
# 💭 Someday / Reference
# ---------------------------------------------------------------------------
with tabs[5]:
    st.subheader("Someday / Maybe")
    someday = db.list_actions(status="someday")
    if not someday:
        st.info("Nothing on the someday list.")
    for a in someday:
        cols = st.columns([0.7, 0.3])
        cols[0].write(f"💭 {a['title']}")
        if cols[1].button("Activate", key=f"act_{a['id']}"):
            db.set_action_status(a["id"], "next")
            st.rerun()

    st.divider()
    st.subheader("Reference")
    refs = db.list_reference()
    if not refs:
        st.info("No reference items yet.")
    for r in refs:
        with st.expander(f"📄 {r['title']}"):
            if r["body"]:
                st.write(r["body"])
            st.caption(r["created_at"])
            if st.button("Delete", key=f"rdel_{r['id']}"):
                db.delete_reference(r["id"])
                st.rerun()

    with st.expander("➕ Add reference item"):
        with st.form("add_ref", clear_on_submit=True):
            rt = st.text_input("Title")
            rb = st.text_area("Body", height=100)
            if st.form_submit_button("Save"):
                try:
                    db.add_reference(rt, rb)
                    st.rerun()
                except ValueError as e:
                    st.error(str(e))


# ---------------------------------------------------------------------------
# 🔄 Weekly Review
# ---------------------------------------------------------------------------
with tabs[6]:
    st.subheader("Weekly Review")
    last = db.last_review("weekly")
    if last:
        st.caption(f"Last weekly review: {last['completed_at']}")
    else:
        st.caption("You haven't completed a weekly review yet.")

    st.markdown(
        """
A weekly review keeps the system trusted. Work through these steps — they should
take 20–60 minutes.
        """
    )

    step1 = st.checkbox(f"1. Process inbox to zero (currently {inbox_n} item(s))")
    if inbox_n > 0:
        st.caption("→ Head to the Clarify tab.")

    step2 = st.checkbox("2. Review every active project and confirm a next action")
    missing = db.projects_missing_next_action()
    if missing:
        st.warning(
            "Projects without a next action:\n"
            + "\n".join(f"- {p['title']}" for p in missing)
        )

    step3 = st.checkbox(f"3. Review Waiting For list ({waiting_n} item(s))")
    step4 = st.checkbox("4. Review Someday/Maybe — anything ready to activate?")
    step5 = st.checkbox("5. Review calendar (past week + upcoming 2 weeks)")
    step6 = st.checkbox("6. Review goals, areas of focus, and any loose ends")

    all_done = all([step1, step2, step3, step4, step5, step6])
    notes = st.text_area("Review notes (optional)", height=80)
    if st.button("Log weekly review", disabled=not all_done, use_container_width=True):
        db.log_review("weekly", notes)
        st.success("Weekly review logged. Nice work.")
        st.balloons()
        st.rerun()
