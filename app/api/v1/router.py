from fastapi import APIRouter

from app.api.v1.endpoints import auth, users, partners, products, commissions, invoices, payments, reports

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(partners.router, prefix="/partners", tags=["Partners"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(commissions.router, prefix="/commissions", tags=["Commissions"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["Invoices"])
api_router.include_router(payments.router, prefix="/payments", tags=["Payments"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
