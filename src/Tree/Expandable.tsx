import { useLayoutEffect, useRef } from 'react';
import styled from 'styled-components';

const DURATION_MS = 200;

const Shell = styled.div`
    overflow: hidden;
    height: 0;
    transition: height ${DURATION_MS}ms ease;

    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`;

const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const setHeightInstant = (el: HTMLDivElement, height: string) => {
    el.style.transition = 'none';
    el.style.height = height;
    void el.offsetHeight;
    el.style.transition = '';
};

const Expandable = ({
    expanded,
    children
}: {
    expanded: boolean;
    children: React.ReactNode;
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const previous = useRef(expanded);

    useLayoutEffect(() => {
        const el = ref.current;

        if (!el) {
            return;
        }

        const wasExpanded = previous.current;
        previous.current = expanded;

        if (wasExpanded === expanded || prefersReducedMotion()) {
            setHeightInstant(el, expanded ? 'auto' : '0px');
            return;
        }

        const from = el.getBoundingClientRect().height;
        const to = expanded ? el.scrollHeight : 0;

        setHeightInstant(el, `${from}px`);
        el.style.height = `${to}px`;

        if (!expanded) {
            return;
        }

        const finish = (event?: TransitionEvent) => {
            if (
                event &&
                (event.target !== el || event.propertyName !== 'height')
            ) {
                return;
            }

            el.style.height = 'auto';
            el.removeEventListener('transitionend', finish);
        };

        el.addEventListener('transitionend', finish);
        const timer = window.setTimeout(finish, DURATION_MS + 50);

        return () => {
            el.removeEventListener('transitionend', finish);
            window.clearTimeout(timer);
        };
    }, [expanded]);

    return (
        <Shell ref={ref} inert={!expanded}>
            {children}
        </Shell>
    );
};

export default Expandable;
