from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from decimal import Decimal
from datetime import datetime

from app.models.commission import Commission, CommissionStatus
from app.models.product import Product
from app.models.commission_rule import CommissionRule
from app.models.partner import Partner
from app.core.exceptions import NotFoundError, ValidationError


class CommissionService:
    @staticmethod
    def calculate_commission(
        db: Session,
        product_id: str,
        base_amount: Decimal,
        competence: str
    ) -> Decimal:
        """Calculate commission based on product rules"""
        
        # Get active commission rule for product
        rule = db.query(CommissionRule).filter(
            CommissionRule.product_id == product_id,
            CommissionRule.is_active == True,
            CommissionRule.valid_from <= datetime.utcnow()
        ).order_by(CommissionRule.valid_from.desc()).first()
        
        if not rule:
            raise NotFoundError(f"No active commission rule found for product {product_id}")
        
        # Calculate based on commission type
        if rule.commission_type == "fixed":
            return rule.fixed_amount
        elif rule.commission_type == "percentage":
            return base_amount * (rule.percentage / 100)
        elif rule.commission_type == "hybrid":
            # Implement hybrid logic based on advanced_rules
            percentage_part = base_amount * (rule.percentage / 100)
            return percentage_part + (rule.fixed_amount or 0)
        
        return Decimal(0)
    
    @staticmethod
    def simulate_commission(
        db: Session,
        product_id: str,
        base_amount: Decimal,
        competence: str
    ):
        """Simulate commission calculation"""
        
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise NotFoundError("Product not found")
        
        commission_amount = CommissionService.calculate_commission(
            db=db,
            product_id=product_id,
            base_amount=base_amount,
            competence=competence
        )
        
        rule = db.query(CommissionRule).filter(
            CommissionRule.product_id == product_id,
            CommissionRule.is_active == True
        ).first()
        
        return {
            "product_id": product_id,
            "product_name": product.name,
            "base_amount": base_amount,
            "commission_amount": commission_amount,
            "commission_type": rule.commission_type if rule else "unknown",
            "rule_applied": {
                "id": rule.id if rule else None,
                "name": rule.name if rule else None,
                "version": rule.version if rule else None
            }
        }
    
    @staticmethod
    def get_dashboard_data(db: Session, partner_id: str):
        """Get dashboard data for partner"""
        
        # Total commissions to receive (approved but not paid)
        to_receive = db.query(func.sum(Commission.commission_amount)).filter(
            Commission.partner_id == partner_id,
            Commission.status == CommissionStatus.APPROVED
        ).scalar() or 0
        
        # Total paid
        paid = db.query(func.sum(Commission.commission_amount)).filter(
            Commission.partner_id == partner_id,
            Commission.status == CommissionStatus.PAID
        ).scalar() or 0
        
        # Pending approval
        pending = db.query(func.sum(Commission.commission_amount)).filter(
            Commission.partner_id == partner_id,
            Commission.status == CommissionStatus.PENDING
        ).scalar() or 0
        
        # Recent commissions
        recent = db.query(Commission).filter(
            Commission.partner_id == partner_id
        ).order_by(Commission.created_at.desc()).limit(10).all()
        
        return {
            "to_receive": float(to_receive),
            "paid": float(paid),
            "pending": float(pending),
            "recent_commissions": recent
        }
