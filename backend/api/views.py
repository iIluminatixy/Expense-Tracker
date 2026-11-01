import csv
import io
from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.db.models import Sum
from django.http import HttpResponse
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .emails import (
    send_expense_added_email,
    send_group_invite_email,
    send_settlement_email,
)
from .models import Group, Expense, ExpenseSplit, UserProfile
from .serializers import (
    UserSerializer,
    RegisterSerializer,
    GroupSerializer,
    GroupCreateSerializer,
    ExpenseSerializer,
    ExpenseListSerializer,
    ExpenseCreateSerializer,
    ExpenseSplitSerializer,
    ProfileSerializer,
)


# ---------------------------------------------------------------------------
# Auth Views
# ---------------------------------------------------------------------------

class RegisterView(APIView):
    """Register a new user account."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response(
                {
                    'user': UserSerializer(user).data,
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """Login with username and password, returns JWT tokens."""
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')

        if not username or not password:
            return Response(
                {'error': 'Username and password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response(
                {'error': 'Invalid credentials.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.check_password(password):
            return Response(
                {'error': 'Invalid credentials.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {'error': 'This account has been deactivated.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                'user': UserSerializer(user).data,
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }
        )


class MeView(APIView):
    """Return the currently authenticated user's profile (including avatar_url)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ProfileView(APIView):
    """GET or PATCH the current user's extended profile (bio + avatar)."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _get_or_create_profile(self, user):
        profile, _ = UserProfile.objects.get_or_create(user=user)
        return profile

    def get(self, request):
        profile = self._get_or_create_profile(request.user)
        return Response(ProfileSerializer(profile).data)

    def patch(self, request):
        profile = self._get_or_create_profile(request.user)

        data = request.data
        files = request.FILES

        if 'avatar' in files:
            profile.avatar = files['avatar']
        if 'bio' in data:
            profile.bio = data['bio']
        profile.save()

        return Response(ProfileSerializer(profile).data)


# ---------------------------------------------------------------------------
# Group Views
# ---------------------------------------------------------------------------

class GroupListCreateView(APIView):
    """List all groups the user belongs to, or create a new group."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        groups = Group.objects.filter(members=request.user).prefetch_related('members')
        serializer = GroupSerializer(groups, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = GroupCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            group = serializer.save()
            return Response(GroupSerializer(group).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GroupDetailView(APIView):
    """Retrieve details for a specific group."""
    permission_classes = [IsAuthenticated]

    def get_group(self, group_id, user):
        try:
            group = Group.objects.prefetch_related('members').get(pk=group_id)
        except Group.DoesNotExist:
            return None, Response({'error': 'Group not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not group.members.filter(pk=user.pk).exists():
            return None, Response({'error': 'You are not a member of this group.'}, status=status.HTTP_403_FORBIDDEN)
        return group, None

    def get(self, request, group_id):
        group, error = self.get_group(group_id, request.user)
        if error:
            return error
        return Response(GroupSerializer(group).data)


class AddMemberView(APIView):
    """Add a member to a group by username."""
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        try:
            group = Group.objects.get(pk=group_id)
        except Group.DoesNotExist:
            return Response({'error': 'Group not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not group.members.filter(pk=request.user.pk).exists():
            return Response(
                {'error': 'You are not a member of this group.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        username = request.data.get('username', '').strip()
        if not username:
            return Response(
                {'error': 'Username is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            new_member = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response(
                {'error': f'User "{username}" not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if group.members.filter(pk=new_member.pk).exists():
            return Response(
                {'error': f'"{username}" is already a member of this group.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        group.members.add(new_member)

        # Send invite email asynchronously
        send_group_invite_email(
            invited_user=new_member,
            group=group,
            invited_by_user=request.user,
        )

        return Response(GroupSerializer(group).data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Expense Views
# ---------------------------------------------------------------------------

class ExpenseListCreateView(APIView):
    """List or create expenses within a group."""
    permission_classes = [IsAuthenticated]

    def get_group(self, group_id, user):
        try:
            group = Group.objects.get(pk=group_id)
        except Group.DoesNotExist:
            return None, Response({'error': 'Group not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not group.members.filter(pk=user.pk).exists():
            return None, Response({'error': 'You are not a member of this group.'}, status=status.HTTP_403_FORBIDDEN)
        return group, None

    def get(self, request, group_id):
        group, error = self.get_group(group_id, request.user)
        if error:
            return error
        expenses = group.expenses.select_related('paid_by').all()
        serializer = ExpenseListSerializer(expenses, many=True)
        return Response(serializer.data)

    def post(self, request, group_id):
        group, error = self.get_group(group_id, request.user)
        if error:
            return error

        serializer = ExpenseCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        # Validate paid_by user is a group member
        try:
            paid_by_user = group.members.get(pk=data['paid_by'])
        except User.DoesNotExist:
            return Response(
                {'error': 'The "paid_by" user is not a member of this group.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create the expense
        expense = Expense.objects.create(
            group=group,
            paid_by=paid_by_user,
            title=data['title'],
            amount=data['amount'],
            split_type=data['split_type'],
            date=data['date'],
        )

        # Create splits
        if data['split_type'] == 'equal':
            participant_ids = data.get('participants', [])
            participants = group.members.filter(pk__in=participant_ids)
            if not participants.exists():
                expense.delete()
                return Response(
                    {'error': 'No valid participants found.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            count = participants.count()
            share = Decimal(str(data['amount'])) / Decimal(count)
            # Round to 2 decimal places; last participant absorbs rounding remainder
            rounded_share = share.quantize(Decimal('0.01'))
            total_distributed = rounded_share * (count - 1)
            last_share = Decimal(str(data['amount'])) - total_distributed

            splits_to_create = []
            participants_list = list(participants)
            for i, participant in enumerate(participants_list):
                amount_owed = last_share if i == count - 1 else rounded_share
                splits_to_create.append(
                    ExpenseSplit(expense=expense, user=participant, amount_owed=amount_owed)
                )
            ExpenseSplit.objects.bulk_create(splits_to_create)

        else:  # custom
            participants_list = []
            for split_data in data.get('custom_splits', []):
                user_id = split_data.get('user')
                amount_owed = Decimal(str(split_data.get('amount', 0)))
                try:
                    split_user = group.members.get(pk=user_id)
                except User.DoesNotExist:
                    expense.delete()
                    return Response(
                        {'error': f'User {user_id} is not a member of this group.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                ExpenseSplit.objects.create(
                    expense=expense, user=split_user, amount_owed=amount_owed
                )
                participants_list.append(split_user)

        # Send email notifications asynchronously
        all_participants = list(participants_list) if data['split_type'] == 'custom' else list(participants)
        # Refresh expense so splits are accessible
        expense.refresh_from_db()
        send_expense_added_email(
            expense=expense,
            group=group,
            added_by_user=request.user,
            participants=all_participants,
        )

        return Response(ExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)


class ExpenseDetailView(APIView):
    """Retrieve a specific expense with its splits."""
    permission_classes = [IsAuthenticated]

    def get(self, request, expense_id):
        try:
            expense = Expense.objects.select_related('paid_by', 'group').prefetch_related(
                'splits__user'
            ).get(pk=expense_id)
        except Expense.DoesNotExist:
            return Response({'error': 'Expense not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not expense.group.members.filter(pk=request.user.pk).exists():
            return Response(
                {'error': 'You are not a member of this group.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(ExpenseSerializer(expense).data)


# ---------------------------------------------------------------------------
# Settlement Views
# ---------------------------------------------------------------------------

def calculate_settlements(group):
    """
    Calculate the minimum number of transactions to settle all debts in a group.
    Uses a greedy algorithm: repeatedly match the largest debtor with the largest creditor.

    Returns a list of dicts: {from_id, from_name, to_id, to_name, amount}
    """
    members = group.members.all()
    balances = {}  # user_id -> net balance (positive = owed money, negative = owes money)

    for member in members:
        balances[member.pk] = {
            'user': member,
            'balance': Decimal('0.00'),
        }

    # For each unsettled split in the group, compute net balances
    for expense in group.expenses.prefetch_related('splits__user').select_related('paid_by').all():
        payer_id = expense.paid_by_id

        # Payer gains credit for what others owe (unsettled splits for other users)
        for split in expense.splits.all():
            if not split.is_settled:
                if split.user_id != payer_id:
                    # The split.user owes payer
                    if split.user_id in balances:
                        balances[split.user_id]['balance'] -= split.amount_owed
                    if payer_id in balances:
                        balances[payer_id]['balance'] += split.amount_owed

    # Greedy settlement algorithm
    debts = []   # (amount, user) — negative balance → owes money
    credits = [] # (amount, user) — positive balance → is owed money

    for uid, data in balances.items():
        bal = data['balance']
        if bal < Decimal('0.00'):
            debts.append([abs(bal), data['user']])
        elif bal > Decimal('0.00'):
            credits.append([bal, data['user']])

    # Sort descending by amount
    debts.sort(key=lambda x: x[0], reverse=True)
    credits.sort(key=lambda x: x[0], reverse=True)

    transactions = []
    i, j = 0, 0
    while i < len(debts) and j < len(credits):
        debt_amount, debtor = debts[i]
        credit_amount, creditor = credits[j]

        settle_amount = min(debt_amount, credit_amount)
        if settle_amount > Decimal('0.00'):
            transactions.append({
                'from_id': debtor.pk,
                'from_name': debtor.get_full_name() or debtor.username,
                'to_id': creditor.pk,
                'to_name': creditor.get_full_name() or creditor.username,
                'amount': str(settle_amount.quantize(Decimal('0.01'))),
            })

        debts[i][0] -= settle_amount
        credits[j][0] -= settle_amount

        if debts[i][0] <= Decimal('0.00'):
            i += 1
        if credits[j][0] <= Decimal('0.00'):
            j += 1

    return transactions


class SettlementView(APIView):
    """Return the balance summary and who-owes-whom for a group."""
    permission_classes = [IsAuthenticated]

    def get(self, request, group_id):
        try:
            group = Group.objects.prefetch_related('members').get(pk=group_id)
        except Group.DoesNotExist:
            return Response({'error': 'Group not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not group.members.filter(pk=request.user.pk).exists():
            return Response(
                {'error': 'You are not a member of this group.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Per-member balances
        member_balances = []
        for member in group.members.all():
            amount_owed_to_member = ExpenseSplit.objects.filter(
                expense__group=group,
                expense__paid_by=member,
                is_settled=False,
            ).exclude(user=member).aggregate(total=Sum('amount_owed'))['total'] or Decimal('0.00')

            amount_member_owes = ExpenseSplit.objects.filter(
                expense__group=group,
                user=member,
                is_settled=False,
            ).exclude(expense__paid_by=member).aggregate(total=Sum('amount_owed'))['total'] or Decimal('0.00')

            net_balance = amount_owed_to_member - amount_member_owes

            member_balances.append({
                'user_id': member.pk,
                'username': member.username,
                'display_name': member.get_full_name() or member.username,
                'net_balance': str(net_balance.quantize(Decimal('0.01'))),
            })

        transactions = calculate_settlements(group)

        return Response({
            'member_balances': member_balances,
            'transactions': transactions,
        })


class SettleSplitView(APIView):
    """Mark an ExpenseSplit as settled."""
    permission_classes = [IsAuthenticated]

    def post(self, request, split_id):
        try:
            split = ExpenseSplit.objects.select_related(
                'expense__group', 'user', 'expense__paid_by'
            ).get(pk=split_id)
        except ExpenseSplit.DoesNotExist:
            return Response({'error': 'Split not found.'}, status=status.HTTP_404_NOT_FOUND)

        group = split.expense.group
        if not group.members.filter(pk=request.user.pk).exists():
            return Response(
                {'error': 'You are not a member of this group.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        split.is_settled = True
        split.save()

        # Send settlement email: payer = person who paid the original expense (creditor),
        # payee = the split user who now settled their debt.
        payer = split.user          # the debtor who is now settling
        payee = split.expense.paid_by  # the creditor who gets notified
        send_settlement_email(
            payer=payer,
            payee=payee,
            amount=split.amount_owed,
            group=group,
        )

        return Response(ExpenseSplitSerializer(split).data)


# ---------------------------------------------------------------------------
# Export Views
# ---------------------------------------------------------------------------

class ExportGroupCSVView(APIView):
    """Export all expenses in a group as a CSV file."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            group = Group.objects.prefetch_related('members', 'expenses__splits__user').get(pk=pk)
        except Group.DoesNotExist:
            return Response({'error': 'Group not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not group.members.filter(pk=request.user.pk).exists():
            return Response({'error': 'You are not a member of this group.'}, status=status.HTTP_403_FORBIDDEN)

        response = HttpResponse(content_type='text/csv')
        safe_name = group.name.replace(' ', '_').replace('/', '-')
        response['Content-Disposition'] = f'attachment; filename="group_{safe_name}_expenses.csv"'

        writer = csv.writer(response)

        # Header row
        writer.writerow(['#', 'Title', 'Amount (₹)', 'Paid By', 'Date', 'Split Type', 'Your Share (₹)', 'Settled'])

        expenses = group.expenses.select_related('paid_by').prefetch_related('splits__user').all()

        for idx, expense in enumerate(expenses, start=1):
            # Find requesting user's split for this expense
            your_split = next(
                (s for s in expense.splits.all() if s.user_id == request.user.pk),
                None,
            )
            your_share = str(your_split.amount_owed) if your_split else '—'
            settled = 'Yes' if (your_split and your_split.is_settled) else 'No' if your_split else '—'

            writer.writerow([
                idx,
                expense.title,
                str(expense.amount),
                expense.paid_by.get_full_name() or expense.paid_by.username,
                str(expense.date),
                expense.split_type.capitalize(),
                your_share,
                settled,
            ])

        # Blank separator row
        writer.writerow([])

        # Settlement summary at the bottom
        writer.writerow(['Settlement Summary'])
        writer.writerow(['From', 'To', 'Amount (₹)'])
        for txn in calculate_settlements(group):
            writer.writerow([txn['from_name'], txn['to_name'], txn['amount']])

        return response


class ExportGroupPDFView(APIView):
    """Export a group's expense report as a professionally styled PDF."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            group = Group.objects.prefetch_related('members', 'expenses').get(pk=pk)
        except Group.DoesNotExist:
            return Response({'error': 'Group not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not group.members.filter(pk=request.user.pk).exists():
            return Response({'error': 'You are not a member of this group.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import cm
            from reportlab.platypus import (
                SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
            )
        except ImportError:
            return Response(
                {'error': 'reportlab is not installed. Run: pip install reportlab'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2 * cm,
            leftMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm,
        )

        PRIMARY = colors.HexColor('#4F46E5')
        LIGHT_BG = colors.HexColor('#EEF2FF')
        GRAY_TEXT = colors.HexColor('#6B7280')
        DARK = colors.HexColor('#111827')

        styles = getSampleStyleSheet()
        story = []

        # --- Header ---
        header_style = ParagraphStyle(
            'AppHeader',
            fontSize=28,
            textColor=PRIMARY,
            fontName='Helvetica-Bold',
            spaceAfter=4,
        )
        story.append(Paragraph('💳 Expense Tracker', header_style))

        subtitle_style = ParagraphStyle(
            'Subtitle',
            fontSize=16,
            textColor=DARK,
            fontName='Helvetica-Bold',
            spaceAfter=2,
        )
        story.append(Paragraph(f'Group Report: {group.name}', subtitle_style))

        meta_style = ParagraphStyle(
            'Meta',
            fontSize=10,
            textColor=GRAY_TEXT,
            spaceAfter=16,
        )
        story.append(Paragraph(f'Generated on {date.today().strftime("%B %d, %Y")}', meta_style))
        story.append(HRFlowable(width='100%', thickness=1, color=PRIMARY, spaceAfter=16))

        # --- Summary Box ---
        expenses_qs = group.expenses.select_related('paid_by').prefetch_related('splits__user').all()
        total_amount = sum(e.amount for e in expenses_qs)
        member_count = group.members.count()
        expense_count = expenses_qs.count()

        summary_data = [
            ['Total Expenses', 'Total Amount', 'Members'],
            [str(expense_count), f'₹{total_amount}', str(member_count)],
        ]
        summary_table = Table(summary_data, colWidths=[5 * cm, 5 * cm, 5 * cm])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BACKGROUND', (0, 1), (-1, 1), LIGHT_BG),
            ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 1), (-1, 1), 14),
            ('TEXTCOLOR', (0, 1), (-1, 1), PRIMARY),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0, 0), (-1, -1), None),
            ('BOX', (0, 0), (-1, -1), 1, PRIMARY),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#C7D2FE')),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 20))

        # --- Expenses Table ---
        section_style = ParagraphStyle(
            'SectionTitle',
            fontSize=13,
            textColor=DARK,
            fontName='Helvetica-Bold',
            spaceBefore=12,
            spaceAfter=8,
        )
        story.append(Paragraph('Expenses', section_style))

        exp_header = ['#', 'Title', 'Amount (₹)', 'Paid By', 'Date', 'Split Type']
        exp_rows = [exp_header]

        for idx, expense in enumerate(expenses_qs, start=1):
            exp_rows.append([
                str(idx),
                expense.title,
                f'₹{expense.amount}',
                expense.paid_by.get_full_name() or expense.paid_by.username,
                str(expense.date),
                expense.split_type.capitalize(),
            ])

        col_widths = [1 * cm, 5.5 * cm, 3 * cm, 3.5 * cm, 3 * cm, 2.5 * cm]
        exp_table = Table(exp_rows, colWidths=col_widths, repeatRows=1)
        exp_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#E5E7EB')),
            ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#E5E7EB')),
        ]))
        story.append(exp_table)
        story.append(Spacer(1, 20))

        # --- Settlement Summary ---
        story.append(Paragraph('Settlement Summary', section_style))

        transactions = calculate_settlements(group)
        if transactions:
            settle_header = ['From', 'To', 'Amount (₹)']
            settle_rows = [settle_header]
            for txn in transactions:
                settle_rows.append([txn['from_name'], txn['to_name'], f"₹{txn['amount']}"])

            settle_table = Table(settle_rows, colWidths=[6 * cm, 6 * cm, 5.5 * cm])
            settle_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7C3AED')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F3FF')]),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 7),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#E5E7EB')),
                ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#E5E7EB')),
            ]))
            story.append(settle_table)
        else:
            no_settle_style = ParagraphStyle('NoSettle', fontSize=10, textColor=GRAY_TEXT)
            story.append(Paragraph('All debts are settled! 🎉', no_settle_style))

        # --- Footer ---
        story.append(Spacer(1, 30))
        story.append(HRFlowable(width='100%', thickness=0.5, color=GRAY_TEXT))
        footer_style = ParagraphStyle(
            'Footer',
            fontSize=8,
            textColor=GRAY_TEXT,
            alignment=1,
            spaceBefore=6,
        )
        story.append(Paragraph('Generated by Expense Tracker', footer_style))

        doc.build(story)
        buffer.seek(0)

        response = HttpResponse(buffer, content_type='application/pdf')
        safe_name = group.name.replace(' ', '_').replace('/', '-')
        response['Content-Disposition'] = f'attachment; filename="group_{safe_name}_report.pdf"'
        return response
