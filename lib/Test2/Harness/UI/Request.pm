package Test2::Harness::UI::Request;
use strict;
use warnings;

use Data::GUID;
use Carp qw/croak/;

use parent 'Plack::Request';

sub new {
    my $class = shift;
    my %params = @_;

    my $env = delete $params{env} or croak "'env' is a required attribute";

    my $self = $class->SUPER::new($env);
    $self->{'config'} = delete $params{config} or croak "'config' is a required attribute";

    return $self;
}

sub schema { $_[0]->{config}->schema }

sub session {
    my $self = shift;

    return $self->{session} if $self->{session};

    my $schema = $self->schema;

    my $session;
    my $cookies = $self->cookies;

    if (my $id = $cookies->{id}) {
        $session = $schema->resultset('Session')->find({session_id => $id});
        $session = undef unless $session && $session->active;
    }

    $session ||= $self->schema->resultset('Session')->create(
        {session_id => Data::GUID->new->as_string},
    );

    $self->{session} = $session;

    # Vivify this
    $self->session_host;

    return $session;
}

my $warned = 0;
sub session_host {
    my $self = shift;

    return $self->{session_host} if $self->{session_host};

    my $session = $self->session or return undef;

    my $schema = $self->schema;

    $schema->txn_begin;

    my $host = $schema->resultset('SessionHost')->find_or_create(
        {
            session_id => $session->session_id,
            address    => $self->address,
            agent      => $self->user_agent,
        }
    );

    warn "Update session-host access time" unless $warned++;

    $schema->txn_commit;

    return $self->{session_host} = $host;
}

sub user {
    my $self = shift;

    return $self->schema->resultset('User')->find({username => 'root'})
        if $self->{config}->single_user;

    my $host = $self->session_host or return undef;

    return undef unless $host->user_id;
    return $host->user;
}

1;