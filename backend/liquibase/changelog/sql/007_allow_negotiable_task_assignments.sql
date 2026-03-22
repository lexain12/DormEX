ALTER TABLE task_assignments
    DROP CONSTRAINT IF EXISTS chk_task_assignments_payment;

ALTER TABLE task_assignments
    ADD CONSTRAINT chk_task_assignments_payment
        CHECK (
            (agreed_payment_type = 'fixed_price' AND agreed_price_amount IS NOT NULL AND agreed_price_amount > 0 AND agreed_barter_description IS NULL)
            OR (agreed_payment_type = 'barter' AND agreed_price_amount IS NULL AND agreed_barter_description IS NOT NULL)
            OR (agreed_payment_type = 'negotiable' AND agreed_price_amount IS NULL AND agreed_barter_description IS NULL)
        );
