from django.contrib.auth.models import User
from django.db import models


class UserProfile(models.Model):
    """Extended profile for each user — avatar and bio."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    bio = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return f"{self.user.username}'s profile"

    def get_avatar_url(self):
        if self.avatar:
            return self.avatar.url
        return None


class Group(models.Model):
    """A group of users who share expenses together."""
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='created_groups'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    members = models.ManyToManyField(User, related_name='expense_groups', blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class Expense(models.Model):
    """An expense shared among group members."""
    SPLIT_TYPE_CHOICES = [
        ('equal', 'Equal'),
        ('custom', 'Custom'),
    ]

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='expenses')
    paid_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='paid_expenses')
    title = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    split_type = models.CharField(max_length=10, choices=SPLIT_TYPE_CHOICES, default='equal')
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f'{self.title} - {self.amount}'


class ExpenseSplit(models.Model):
    """Tracks how much each user owes for a given expense."""
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name='splits')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='expense_splits')
    amount_owed = models.DecimalField(max_digits=10, decimal_places=2)
    is_settled = models.BooleanField(default=False)

    class Meta:
        unique_together = ('expense', 'user')

    def __str__(self):
        return f'{self.user.username} owes {self.amount_owed} for {self.expense.title}'
