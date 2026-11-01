from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    # Auth
    path('auth/register/', views.RegisterView.as_view(), name='auth-register'),
    path('auth/login/', views.LoginView.as_view(), name='auth-login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('auth/me/', views.MeView.as_view(), name='auth-me'),
    path('auth/profile/', views.ProfileView.as_view(), name='auth-profile'),

    # Groups
    path('groups/', views.GroupListCreateView.as_view(), name='group-list-create'),
    path('groups/<int:group_id>/', views.GroupDetailView.as_view(), name='group-detail'),
    path('groups/<int:group_id>/members/', views.AddMemberView.as_view(), name='group-add-member'),

    # Expenses
    path('groups/<int:group_id>/expenses/', views.ExpenseListCreateView.as_view(), name='expense-list-create'),
    path('expenses/<int:expense_id>/', views.ExpenseDetailView.as_view(), name='expense-detail'),

    # Settlements
    path('groups/<int:group_id>/settlements/', views.SettlementView.as_view(), name='group-settlements'),
    path('splits/<int:split_id>/settle/', views.SettleSplitView.as_view(), name='split-settle'),

    # Exports
    path('groups/<int:pk>/export/csv/', views.ExportGroupCSVView.as_view(), name='export-csv'),
    path('groups/<int:pk>/export/pdf/', views.ExportGroupPDFView.as_view(), name='export-pdf'),
]
