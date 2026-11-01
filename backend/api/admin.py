from django.contrib import admin
from .models import Group, Expense, ExpenseSplit, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'bio')
    search_fields = ('user__username',)


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_by', 'created_at')
    search_fields = ('name',)
    filter_horizontal = ('members',)


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('title', 'group', 'paid_by', 'amount', 'split_type', 'date')
    list_filter = ('split_type', 'group')
    search_fields = ('title',)


@admin.register(ExpenseSplit)
class ExpenseSplitAdmin(admin.ModelAdmin):
    list_display = ('expense', 'user', 'amount_owed', 'is_settled')
    list_filter = ('is_settled',)
