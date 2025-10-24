from sqlalchemy.orm import Session
from typing import Optional

from app.models.payment import Payment, PaymentStatus
from app.models.commission import Commission, CommissionStatus
from app.models.partner import Partner
from app.models.user import User, UserRole


class PaymentService:
    @staticmethod
    def list_payments(
        db: Session,
        user: User,
        competence: Optional[str] = None,
        skip: int = 0,
        limit: int = 20
    ):
        """List payments"""
        query = db.query(Payment)
        
        # Filter by partner if not admin
        if user.role == UserRole.PARTNER:
            partner = db.query(Partner).filter(Partner.user_id == user.id).first()
            if partner:
                query = query.filter(Payment.partner_id == partner.id)
        
        if competence:
            query = query.filter(Payment.competence == competence)
        
        payments = query.order_by(Payment.created_at.desc()).offset(skip).limit(limit).all()
        return payments
    
    @staticmethod
    def process_payments(db: Session, competence: str):
        """Process payments for approved commissions"""
        
        # Get all approved commissions for the competence
        commissions = db.query(Commission).filter(
            Commission.competence == competence,
            Commission.status == CommissionStatus.APPROVED,
            Commission.payment_id == None
        ).all()
        
        # Group by partner
        partner_commissions = {}
        for commission in commissions:
            if commission.partner_id not in partner_commissions:
                partner_commissions[commission.partner_id] = []
            partner_commissions[commission.partner_id].append(commission)
        
        # Create payments
        payments_created = []
        for partner_id, comms in partner_commissions.items():
            total_amount = sum(c.commission_amount + (c.adjustment_amount or 0) for c in comms)
            
            partner = db.query(Partner).filter(Partner.id == partner_id).first()
            
            # Create payment
            payment = Payment(
                partner_id=partner_id,
                amount=total_amount,
                method="pix" if partner.pix_key else "bank_transfer",
                competence=competence,
                pix_key=partner.pix_key,
                bank_code=partner.bank_code,
                agency=partner.agency,
                account=partner.account
            )
            
            db.add(payment)
            db.flush()
            
            # Link commissions to payment
            for comm in comms:
                comm.payment_id = payment.id
            
            payments_created.append(payment)
        
        db.commit()
        
        return {
            "payments_created": len(payments_created),
            "total_amount": sum(p.amount for p in payments_created)
        }
