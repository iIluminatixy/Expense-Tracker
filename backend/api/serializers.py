from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Group, Expense, ExpenseSplit, UserProfile


# ---------------------------------------------------------------------------
# User serializers
# ---------------------------------------------------------------------------

class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'avatar_url']

    def get_avatar_url(self, obj):
        try:
            return obj.profile.get_avatar_url()
        except UserProfile.DoesNotExist:
            return None


class ProfileSerializer(serializers.ModelSerializer):
    """Used for GET/PATCH of the current user's profile."""
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ['username', 'email', 'first_name', 'last_name', 'bio', 'avatar', 'avatar_url']
        extra_kwargs = {
            'avatar': {'write_only': True, 'required': False},
        }

    def get_avatar_url(self, obj):
        return obj.get_avatar_url()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'first_name', 'last_name']

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('A user with this username already exists.')
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        return user


# ---------------------------------------------------------------------------
# Group serializers
# ---------------------------------------------------------------------------

class GroupSerializer(serializers.ModelSerializer):
    members = UserSerializer(many=True, read_only=True)
    created_by = UserSerializer(read_only=True)
    expense_count = serializers.SerializerMethodField()
    total_expenses = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = [
            'id', 'name', 'description', 'created_by', 'created_at',
            'members', 'member_count', 'expense_count', 'total_expenses',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_expense_count(self, obj):
        return obj.expenses.count()

    def get_total_expenses(self, obj):
        from django.db.models import Sum
        result = obj.expenses.aggregate(total=Sum('amount'))
        return str(result['total'] or '0.00')

    def get_member_count(self, obj):
        return obj.members.count()


class GroupCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ['id', 'name', 'description']

    def create(self, validated_data):
        request = self.context['request']
        group = Group.objects.create(
            created_by=request.user,
            **validated_data
        )
        # Creator is automatically a member
        group.members.add(request.user)
        return group


# ---------------------------------------------------------------------------
# ExpenseSplit serializers
# ---------------------------------------------------------------------------

class ExpenseSplitSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = ExpenseSplit
        fields = ['id', 'user', 'amount_owed', 'is_settled']


# ---------------------------------------------------------------------------
# Expense serializers
# ---------------------------------------------------------------------------

class ExpenseSerializer(serializers.ModelSerializer):
    paid_by = UserSerializer(read_only=True)
    splits = ExpenseSplitSerializer(many=True, read_only=True)

    class Meta:
        model = Expense
        fields = [
            'id', 'title', 'amount', 'paid_by', 'split_type',
            'date', 'created_at', 'splits',
        ]
        read_only_fields = ['id', 'created_at', 'splits']


class ExpenseListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing expenses (no splits detail)."""
    paid_by = UserSerializer(read_only=True)

    class Meta:
        model = Expense
        fields = ['id', 'title', 'amount', 'paid_by', 'split_type', 'date', 'created_at']


class ExpenseCreateSerializer(serializers.Serializer):
    """Handles creation of an expense with split logic."""
    title = serializers.CharField(max_length=255)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    paid_by = serializers.IntegerField()
    split_type = serializers.ChoiceField(choices=['equal', 'custom'])
    date = serializers.DateField()
    participants = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )
    custom_splits = serializers.ListField(
        child=serializers.DictField(), required=False, default=list
    )

    def validate(self, data):
        split_type = data.get('split_type')
        participants = data.get('participants', [])
        custom_splits = data.get('custom_splits', [])
        amount = data.get('amount')

        if split_type == 'equal' and not participants:
            raise serializers.ValidationError(
                {'participants': 'Participants list is required for equal split.'}
            )

        if split_type == 'custom':
            if not custom_splits:
                raise serializers.ValidationError(
                    {'custom_splits': 'Custom splits are required for custom split type.'}
                )
            total = sum(float(s.get('amount', 0)) for s in custom_splits)
            if abs(total - float(amount)) > 0.01:
                raise serializers.ValidationError(
                    {'custom_splits': f'Custom splits sum ({total}) must equal total amount ({amount}).'}
                )

        return data
