-- Currency lifecycle columns are not removed after activation.
SELECT RAISE(ABORT, 'currency lifecycle down migration is refused after activation');
