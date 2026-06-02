SELECT status, COUNT(*) as count FROM order_dispatch_requests WHERE order_id = 'ec23ded7-f6fb-4e03-8e5b-0d94ade24e74' AND status IN ('completed', 'submitted', 'pending_feedback') GROUP BY status;
