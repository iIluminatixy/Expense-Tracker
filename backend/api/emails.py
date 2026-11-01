"""
Email utility functions for the Expense Tracker application.
All email sending is done asynchronously using threading so API responses
are not blocked.
"""

import threading

from django.core.mail import send_mail
from django.conf import settings


def _send_async(subject, message, recipient_list):
    """Helper that fires send_mail in a background daemon thread."""
    def _task():
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipient_list,
                fail_silently=True,
            )
        except Exception:
            pass  # Never let email errors surface to the caller

    t = threading.Thread(target=_task, daemon=True)
    t.start()


def send_expense_added_email(expense, group, added_by_user, participants):
    """
    Notify all participants (except the adder) that a new expense was added.

    Args:
        expense: Expense model instance (must have .title, .amount, .splits)
        group: Group model instance (must have .name)
        added_by_user: User who added the expense
        participants: QuerySet / list of User objects involved in the expense
    """
    # Build a mapping of user_id -> split amount from the expense splits
    split_map = {
        split.user_id: split.amount_owed
        for split in expense.splits.all()
    }

    for user in participants:
        if user.pk == added_by_user.pk:
            continue  # Don't notify the person who added it
        if not user.email:
            continue

        your_share = split_map.get(user.pk, expense.amount)
        subject = f"New expense added in {group.name}"
        message = (
            f"Hi {user.username},\n\n"
            f"{added_by_user.get_full_name() or added_by_user.username} added "
            f"'{expense.title}' for \u20b9{expense.amount} in the group '{group.name}'.\n\n"
            f"Your share: \u20b9{your_share}\n\n"
            f"Log in to Expense Tracker to view the full details.\n\n"
            f"— Expense Tracker"
        )
        _send_async(subject, message, [user.email])


def send_group_invite_email(invited_user, group, invited_by_user):
    """
    Notify a user that they have been added to a group.

    Args:
        invited_user: User who was added
        group: Group model instance
        invited_by_user: User who added them
    """
    if not invited_user.email:
        return

    subject = f"You've been added to group '{group.name}'"
    message = (
        f"Hi {invited_user.username},\n\n"
        f"{invited_by_user.get_full_name() or invited_by_user.username} added you to "
        f"the group '{group.name}' on Expense Tracker.\n\n"
        f"Log in to view your expenses and balances.\n\n"
        f"— Expense Tracker"
    )
    _send_async(subject, message, [invited_user.email])


def send_settlement_email(payer, payee, amount, group):
    """
    Notify payee that payer has marked a debt as settled.

    Args:
        payer: User who paid / settled
        payee: User who was owed money
        amount: Decimal amount settled
        group: Group model instance
    """
    if not payee.email:
        return

    subject = f"Debt settled in {group.name}"
    message = (
        f"Hi {payee.username},\n\n"
        f"{payer.get_full_name() or payer.username} has marked \u20b9{amount} as settled "
        f"to you in group '{group.name}'.\n\n"
        f"Log in to Expense Tracker to review your updated balances.\n\n"
        f"— Expense Tracker"
    )
    _send_async(subject, message, [payee.email])
