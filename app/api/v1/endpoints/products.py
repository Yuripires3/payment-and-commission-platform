from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.product import Product

router = APIRouter()


@router.get("/")
async def list_products(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all products"""
    products = db.query(Product).filter(Product.is_active == True).offset(skip).limit(limit).all()
    return products


@router.post("/")
async def create_product(
    product_data: dict,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db)
):
    """Create new product (admin only)"""
    product = Product(**product_data)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product
